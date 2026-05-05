# Vesper Launcher - TODO

## Completed Tasks

### 1. Fixed `pnpm dev` to Open Tauri Window
- Updated `package.json` so `dev` runs `npm run tauri:dev` (since pnpm was broken in WSL)
- Fixed `beforeDevCommand` in `tauri.conf.json` to use `npm run dev:server`
- Updated `beforeBuildCommand` to use `npm run build` instead of pnpm

### 2. Fixed Titlebar Dragging & Window Controls
- Added `data-tauri-drag-region` to TitleBar for dragging
- Added Tauri v2 permissions in `capabilities/default.json`:
  - `core:window:allow-close`
  - `core:window:allow-minimize`
  - `core:window:allow-toggle-maximize`
  - `core:window:allow-start-dragging`
- Created missing SVG icons for window controls:
  - `/src/assets/svg/minimize.svg`
  - `/src/assets/svg/maximize.svg`
  - `/src/assets/svg/close.svg`

### 3. Minimalistic Theme with `#0a0a0a` Background
- Updated CSS variables in `/src/styles/globals.css`:
  - Background: `--bg: 0 0% 3.9%` (maps to `#0a0a0a`)
  - Surfaces: `--surface-1: 0 0% 6.5%`, `--surface-2: 0 0% 9%`, `--surface-3: 0 0% 12%`
  - Accent: `--accent: 26.6 100% 70%` (lighter than before)
  - Borders: `white/[0.04-0.10]` (subtle)
- Thinner scrollbars (8px instead of 12px)
- Smaller radius (12px instead of 14px)
- Reduced border opacities for cleaner look
- Updated body background with minimal radial gradients

### 4. Replaced All Blue Tones
- Replaced `#101317` (Sidebar) → `#0a0a0a`
- Replaced `#151a20` (InstanceCard) → `#0d0d0d`
- Replaced `#181d24` (DiscoverModsSection) → `#0d0d0d`
- Replaced `#11161c` (12+ occurrences) → `#0d0d0d`
- Replaced `#78c8ff` (blue maximize icon) → `#ffcea7` (accent)
- Updated window control buttons to use `text-white/40 hover:text-[#ffcea7]`

### 5. Window Control Buttons Restyled
- Subtle `text-white/40` with `hover:text-[#ffcea7]` for minimize/maximize
- Red tint only for close button on hover (`text-white/40 hover:text-[#ff7388]`)
- Simplified SVG icons (16px, thinner 1.5px strokes)
- Updated button styling to use `rounded-lg` instead of `rounded-xl`

### 6. Microsoft OAuth2 Implementation
- Added auto-login prompt on startup if not logged in
- Login flow handled in AppShell with polling
- "Skip for now" option available
- Login UI shows Microsoft code and opens browser automatically
- Added to store:
  - `shouldPromptLogin()` function to check if login is needed
  - `beginMicrosoftLogin()` - starts device login flow
  - `pollMicrosoftLogin()` - polls for completion
  - `logoutMicrosoft()` - signs out
- Created login prompt UI in AppShell with:
  - Welcome modal with "Sign in with Microsoft" button
  - Login code display with copy and open browser buttons
  - Auto-poll every 5 seconds until complete

### 7. Disabled Right-Click Context Menu
- Added `contextmenu` event listener in `src/main.tsx` to prevent default

### 8. Custom Error Page with TitleBar
- Created `/src/components/layout/ErrorLayout.tsx` with TitleBar included
- Created fallback `DefaultErrorPage` in case custom one fails
- Updated router to use `errorElement: <ErrorLayout />`
- Error page shows:
  - ⚠️ icon
  - "Something went wrong" heading
  - Error message (if available)
  - "Reload App" and "Go Back" buttons
- Fixed Button component import issues in AppShell and ErrorLayout

### 9. Code Cleanup
- Removed unused imports from PlayingAsCard.tsx
- Fixed duplicate functions in AppShell.tsx
- Updated TypeScript types in launcher-store.ts
- Killed port 1420 conflicts by using dynamic Vite port assignment

---

## Future Tasks

### High Priority
- [ ] **Test Microsoft OAuth2 Flow**
  - Click "Sign in with Microsoft" button
  - Verify code is displayed and browser opens
  - Complete login in browser
  - Verify auto-polling completes and user is logged in
  - Test "Skip for now" button
  - Test logout functionality

### Medium Priority
- [ ] **Fix Rust Compilation Warnings**
  - Remove or use `CURSEFORGE_API_ROOT` constant
  - Remove or implement `CurseForgeDownloadInput` struct
  - Remove or implement `curseforge_api_key` function
  - Remove or implement `curseforge_loader_id` function
  - Remove or implement `map_curseforge_mod` function
  - Remove or implement `discover_search_curseforge` function
  - Remove or implement `discover_download_curseforge` function

- [ ] **Test Window Controls**
  - Verify minimize button works
  - Verify maximize/restore button works
  - Verify close button works
  - Test double-click on titlebar to maximize/restore

- [ ] **Test Error Page**
  - Navigate to non-existent route (e.g., `#/non-existent`)
  - Verify ErrorLayout shows with TitleBar
  - Test "Reload App" button
  - Test "Go Back" button

### Low Priority
- [ ] **UI Polish**
  - Review all components for remaining blue/gray tones
  - Ensure consistent spacing and typography
  - Add loading skeletons for Microsoft login state
  - Add success/error toasts for login actions

- [ ] **Performance**
  - Check for unnecessary re-renders in AppShell
  - Optimize polling interval for Microsoft login
  - Consider using React.memo for expensive components

- [ ] **Documentation**
  - Add JSDoc comments to new functions
  - Update README with new features
  - Document Microsoft OAuth2 setup (client ID configuration)

---

## Configuration Files Modified
- `/package.json` - Updated scripts
- `/src-tauri/tauri.conf.json` - Removed beforeDevCommand, updated devUrl
- `/src-tauri/capabilities/default.json` - Added Tauri v2 permissions
- `/src/styles/globals.css` - New minimalistic theme
- `/src/main.tsx` - Disabled right-click context menu
- `/src/router.tsx` - Added errorElement
- `/src/components/layout/AppShell.tsx` - Added Microsoft login UI
- `/src/components/layout/TitleBar.tsx` - Updated button styles
- `/src/components/layout/ErrorLayout.tsx` - Created new error page
- `/src/components/account/PlayingAsCard.tsx` - Simplified, removed duplicate login logic
- `/src/store/launcher-store.ts` - Added shouldPromptLogin function
- `/src/lib/ipc.ts` - Already had correct Microsoft login IPC functions

## Notes
- pnpm is broken in WSL (wraps to non-existent node path)
- Using npm as fallback: `npm run tauri:dev`
- Vite dev server port may change dynamically (1420, 1421, 1422, 1423, etc.)
- Tauri v2 uses capability files for permissions (not tauri.conf.json)
