use std::sync::{Arc, Mutex};

use anyhow::{Context as _, Result};
use gpui::{
    Context, FontWeight, InteractiveElement, ParentElement, Render,
    SharedString, StatefulInteractiveElement, Styled, Window, div,
    prelude::FluentBuilder,
};
use tokio::sync::mpsc;

use crate::ui::theme::Theme;

use vesper_core::auth::AuthManager;
use vesper_core::bridge::commands::BackendCommand;
use vesper_core::bridge::updates::UiUpdate;

const MS_CLIENT_ID: &str = "c36a9fb6-4f2a-41ff-90bd-ae7cc92031eb";

pub struct LoginView {
    is_logged_in: bool,
    username: SharedString,
    is_polling: bool,
    auth_error: SharedString,
    cmd_tx: mpsc::Sender<BackendCommand>,
    latest_update: Arc<Mutex<Option<UiUpdate>>>,
}

impl LoginView {
    pub fn new(
        cmd_tx: mpsc::Sender<BackendCommand>,
        latest_update: Arc<Mutex<Option<UiUpdate>>>,
    ) -> Self {
        Self {
            is_logged_in: false,
            username: SharedString::default(),
            is_polling: false,
            auth_error: SharedString::default(),
            cmd_tx,
            latest_update,
        }
    }

    fn poll_updates(&mut self) {
        if let Ok(mut guard) = self.latest_update.lock() {
            if let Some(update) = guard.take() {
                match update {
                    UiUpdate::AuthBrowserLoginStarted => {
                        self.is_polling = true;
                        self.auth_error = SharedString::default();
                    }
                    UiUpdate::AuthSuccess { profile } => {
                        self.is_logged_in = true;
                        self.is_polling = false;
                        self.username = profile.display_name.into();
                    }
                    UiUpdate::AuthError { message } => {
                        self.is_polling = false;
                        self.auth_error = message.into();
                    }
                    UiUpdate::AuthLoggedOut => {
                        self.is_logged_in = false;
                        self.is_polling = false;
                        self.username = SharedString::default();
                    }
                    _ => {}
                }
            }
        }
    }

    fn handle_login(&mut self, _cx: &mut Context<Self>) {
        self.is_polling = true;
        self.auth_error = SharedString::default();

        let update = self.latest_update.clone();

        // Spawn auth flow on a dedicated background thread with its own tokio runtime.
        // This works around GPUI 0.2.2's AsyncFnOnce lifetime constraints and
        // AuthManager being !Send.
        std::thread::spawn(move || {
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();

            rt.block_on(async move {
                if let Err(e) = run_auth_flow(&update).await {
                    set_update(&update, UiUpdate::AuthError {
                        message: format!("Auth failed: {e:#}"),
                    });
                }
            });
        });
    }

    fn handle_logout(&mut self, _cx: &mut Context<Self>) {
        self.is_logged_in = false;
        self.is_polling = false;
        self.username = SharedString::default();
    }
}

fn set_update(target: &Arc<Mutex<Option<UiUpdate>>>, update: UiUpdate) {
    if let Ok(mut guard) = target.lock() {
        *guard = Some(update);
    }
}

async fn run_auth_flow(update: &Arc<Mutex<Option<UiUpdate>>>) -> Result<()> {
    let auth_manager = AuthManager::new(MS_CLIENT_ID.to_string())
        .context("Failed to initialize auth manager")?;

    let (auth_url, csrf_state, pkce_verifier, port) = auth_manager
        .start_browser_login()
        .await
        .context("Failed to start browser login")?;

    open::that(auth_url.as_str())
        .context("Failed to open browser")?;

    let tokens = auth_manager
        .complete_browser_login(port, &pkce_verifier, &csrf_state)
        .await
        .context("Browser login completion failed")?;

    let mc_profile = tokens
        .mc_profile
        .as_ref()
        .context("No Minecraft profile in auth response")?;

    let profile = vesper_core::auth::models::AuthProfile {
        id: mc_profile.id.clone(),
        display_name: mc_profile.name.clone(),
        email: None,
        account_type: vesper_core::auth::models::AccountType::Java,
        minecraft_username: Some(mc_profile.name.clone()),
        minecraft_uuid: Some(mc_profile.id.clone()),
        xbox_gamertag: None,
        bedrock_profile: None,
        device_keys: None,
        identity_keys: None,
    };

    set_update(update, UiUpdate::AuthSuccess { profile });
    Ok(())
}

impl Render for LoginView {
    fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl gpui::IntoElement {
        // Poll for async updates before rendering
        self.poll_updates();

        if self.is_logged_in {
            div()
                .flex()
                .flex_col()
                .items_center()
                .justify_center()
                .size_full()
                .bg(Theme::base())
                .child(
                    div()
                        .flex()
                        .flex_col()
                        .items_center()
                        .gap_4()
                        .p_8()
                        .rounded_2xl()
                        .bg(Theme::surface0())
                        .shadow_lg()
                        .child(
                            div()
                                .text_2xl()
                                .font_weight(FontWeight(700.0))
                                .text_color(Theme::text())
                                .child("Welcome back!"),
                        )
                        .child(
                            div()
                                .text_xl()
                                .text_color(Theme::green())
                                .child(self.username.clone()),
                        )
                        .child(
                            div()
                                .id("logout-btn")
                                .px_5()
                                .py_2()
                                .rounded_md()
                                .bg(Theme::red())
                                .text_color(Theme::base())
                                .text_sm()
                                .cursor_pointer()
                                .child("Sign Out")
                                .hover(|style| style.bg(Theme::peach()))
                                .on_click(cx.listener(|this, _event, _window, cx| {
                                    this.handle_logout(cx);
                                })),
                        ),
                )
        } else {
            div()
                .flex()
                .flex_col()
                .items_center()
                .justify_center()
                .size_full()
                .bg(Theme::base())
                .child(
                    div()
                        .flex()
                        .flex_col()
                        .items_center()
                        .gap_4()
                        .p_8()
                        .rounded_2xl()
                        .bg(Theme::surface0())
                        .shadow_lg()
                        .child(
                            div()
                                .text_3xl()
                                .font_weight(FontWeight(700.0))
                                .text_color(Theme::mauve())
                                .child("Vesper Client"),
                        )
                        .child(
                            div()
                                .text_base()
                                .text_color(Theme::subtext0())
                                .child("Sign in with your Microsoft account"),
                        )
                        .when(!self.is_polling, |this| {
                            this.child(
                                div()
                                    .id("login-btn")
                                    .px_5()
                                    .py_2()
                                    .rounded_md()
                                    .bg(Theme::mauve())
                                    .text_color(Theme::base())
                                    .text_sm()
                                    .cursor_pointer()
                                    .child("Sign in with Microsoft")
                                    .hover(|style| style.bg(Theme::blue()))
                                    .on_click(cx.listener(|this, _event, _window, cx| {
                                        this.handle_login(cx);
                                    })),
                            )
                        })
                        .when(self.is_polling, |this| {
                            this.child(
                                div()
                                    .flex()
                                    .flex_col()
                                    .items_center()
                                    .gap_2()
                                    .child(
                                        div()
                                            .text_base()
                                            .text_color(Theme::subtext0())
                                            .child("Waiting for browser authentication..."),
                                    )
                                    .child(
                                        div()
                                            .text_sm()
                                            .text_color(Theme::overlay0())
                                            .child(
                                                "Sign in using the browser window that opened, then return here.",
                                            ),
                                    ),
                            )
                        })
                        .when(!self.auth_error.is_empty(), |this| {
                            this.child(
                                div()
                                    .text_sm()
                                    .text_color(Theme::red())
                                    .child(self.auth_error.clone()),
                            )
                        }),
                )
        }
    }
}
