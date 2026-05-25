# Vesper Launcher - TODO

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
