# Bridge Architecture: GPUI <-> Tokio

The Vesper Client uses a two-thread architecture where GPUI runs on the main thread with its event loop, and async domain work (auth, installs, downloads) runs on a dedicated OS thread with its own tokio runtime. Communication between them uses `Arc<Mutex<Option<UiUpdate>>>` shared state.

## Why Not MPSC?

Slint used unbounded MPSC channels with `slint::spawn_local` for cross-thread communication. GPUI 0.2.2 has different constraints:

1. **`cx.spawn()` requires `AsyncFnOnce`** with lifetime bounds that prevent moving `!Send` types (like `AuthManager`) into async closures
2. **No `slint::spawn_local` equivalent** — GPUI's render loop is synchronous; views update in `Render::render()`
3. **`Arc<Mutex<Option<T>>>`** is simpler for single-value updates where the latest state matters more than a queue of events

The current prototype uses shared state. A full migration may reintroduce MPSC for high-frequency updates (progress bars) or events that need guaranteed delivery.

## Threading Model

```
┌────────────────────────────────┐     ┌──────────────────────────────────┐
│  Main Thread (GPUI)            │     │  Background Thread                │
│                                │     │  (dedicated tokio runtime)        │
│  tracing_subscriber::init()    │     │                                  │
│  Application::new()            │     │  Builder::new_current_thread()    │
│    .run(|cx| {                 │     │    .enable_all().build()          │
│      cx.open_window(..., |cx| { │     │                                  │
│        cx.new(|cx| {           │     │  AuthManager::new(client_id)      │
│          LoginView::new(       │     │  InstanceManager::new()           │
│            cmd_tx,             │     │  ModManager::new(...)             │
│            latest_update       │     │                                  │
│          )                     │     │  // Work writes to shared state:  │
│        })                      │     │  *guard = Some(UiUpdate::...);   │
│      })                        │     │                                  │
│    });                         │     └──────────────────────────────────┘
│                                │
│  Render::render()              │     Shared state read on render:
│    self.poll_updates();        │     if let Some(update) = guard.take()
│    // applies state changes    │
└────────────────────────────────┘
```

## Shared State Types

```rust
// Single latest-update slot (used for auth results, errors, etc.)
let latest_update: Arc<Mutex<Option<UiUpdate>>> = Arc::new(Mutex::new(None));

// MPSC channel for commands (reserved for future use)
let (cmd_tx, cmd_rx) = mpsc::channel::<BackendCommand>(64);
```

`Arc<Mutex<Option<UiUpdate>>>` works well for:
- Auth success/error results
- One-shot status updates
- State that changes infrequently (login status, instance list)

It does NOT work well for:
- High-frequency progress updates (download progress bars)
- Multiple queued events that must not be dropped
- Command dispatch (the MPSC channel is retained for this)

## Background Thread Spawning

Each async operation spawns a dedicated thread with its own tokio runtime:

```rust
fn handle_login(&mut self, cx: &mut Context<Self>) {
    let update = self.latest_update.clone();

    std::thread::spawn(move || {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();

        rt.block_on(async move {
            let auth_manager = AuthManager::new(MS_CLIENT_ID.to_string())?;
            let (auth_url, csrf, pkce, port) =
                auth_manager.start_browser_login().await?;

            open::that(auth_url.as_str())?;

            match auth_manager.complete_browser_login(port, &pkce, &csrf).await {
                Ok(tokens) => {
                    let profile = /* build AuthProfile from tokens */;
                    set_update(&update, UiUpdate::AuthSuccess { profile });
                }
                Err(e) => {
                    set_update(&update, UiUpdate::AuthError { message: e.to_string() });
                }
            }
        });
    });
}
```

The helper writes the result to shared state:

```rust
fn set_update(target: &Arc<Mutex<Option<UiUpdate>>>, update: UiUpdate) {
    if let Ok(mut guard) = target.lock() {
        *guard = Some(update);
    }
}
```

## Polling in Render

Every view polls shared state at the start of `Render::render()`:

```rust
impl Render for LoginView {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
        // Consume any pending async updates
        self.poll_updates();

        // ... build UI tree based on current state
    }
}
```

`poll_updates` takes the latest update and applies it:

```rust
fn poll_updates(&mut self) {
    if let Ok(mut guard) = self.latest_update.lock() {
        if let Some(update) = guard.take() {
            match update {
                UiUpdate::AuthSuccess { profile } => {
                    self.is_logged_in = true;
                    self.is_polling = false;
                    self.username = profile.display_name.into();
                }
                UiUpdate::AuthError { message } => {
                    self.is_polling = false;
                    self.auth_error = message.into();
                }
                // ... other variants
            }
        }
    }
}
```

## Error Propagation Across the Bridge

Errors flow back to the UI through `UiUpdate` variants:

```rust
// In background thread:
match auth_manager.complete_browser_login(port, &pkce, &csrf).await {
    Ok(tokens) => {
        set_update(&update, UiUpdate::AuthSuccess { profile });
    }
    Err(e) => {
        set_update(&update, UiUpdate::AuthError { message: e.to_string() });
    }
}
```

The UI never receives raw `CoreError` values. All errors are converted to `String` messages inside `UiUpdate` error variants. The `poll_updates` function handles these by setting error state on the view.

## Shutdown

When the user closes the window, GPUI's event loop exits and `Application::run()` returns. The `cmd_tx` sender is dropped, and background threads finish their current work and exit when they no longer hold references to shared state.
