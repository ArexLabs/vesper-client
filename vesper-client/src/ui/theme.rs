use gpui::rgb;

use gpui::Rgba;

/// Catppuccin Mocha color palette for Vesper Client.
pub struct Theme;

impl Theme {
    // Base colors
    pub fn base() -> Rgba { rgb(0x11111b) }
    pub fn mantle() -> Rgba { rgb(0x181825) }
    pub fn surface0() -> Rgba { rgb(0x1e1e2e) }
    pub fn surface1() -> Rgba { rgb(0x313244) }
    pub fn surface2() -> Rgba { rgb(0x45475a) }
    pub fn overlay0() -> Rgba { rgb(0x6c7086) }
    pub fn overlay1() -> Rgba { rgb(0x7f849c) }
    pub fn subtext0() -> Rgba { rgb(0xa6adc8) }
    pub fn subtext1() -> Rgba { rgb(0xbac2de) }
    pub fn text() -> Rgba { rgb(0xcdd6f4) }

    // Accent colors
    pub fn mauve() -> Rgba { rgb(0xcba6f7) }
    pub fn blue() -> Rgba { rgb(0x89b4fa) }
    pub fn green() -> Rgba { rgb(0xa6e3a1) }
    pub fn yellow() -> Rgba { rgb(0xf9e2af) }
    pub fn red() -> Rgba { rgb(0xf38ba8) }
    pub fn peach() -> Rgba { rgb(0xfab387) }
    pub fn teal() -> Rgba { rgb(0x94e2d5) }
}
