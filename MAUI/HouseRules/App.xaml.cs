namespace HouseRules
{
    public partial class App : Application
    {
        private readonly AuthService _auth;
        private readonly ApiClient _api;

        public App(AuthService auth, ApiClient api)
        {
            InitializeComponent();
            _auth = auth;
            _api = api;
        }

        protected override Window CreateWindow(IActivationState? activationState)
        {
            var shell = new AppShell();
            var window = new Window(shell);

            shell.Loaded += async (s, e) =>
            {
                await CheckStoredAuthAsync();
            };

#if WINDOWS
            window.Created += (s, e) =>
            {
                var nativeWindow = (window.Handler?.PlatformView as Microsoft.UI.Xaml.Window)!;
                var appWindow = nativeWindow.AppWindow;
                var titleBar = appWindow.TitleBar;

                // Dark title bar to match app theme
                var bg = global::Windows.UI.Color.FromArgb(255, 23, 23, 26);       // #17171A
                var fg = global::Windows.UI.Color.FromArgb(255, 230, 230, 230);    // light text
                var hoverBg = global::Windows.UI.Color.FromArgb(255, 40, 40, 50);
                var pressedBg = global::Windows.UI.Color.FromArgb(255, 50, 50, 60);
                var inactive = global::Windows.UI.Color.FromArgb(255, 140, 140, 140);

                titleBar.BackgroundColor = bg;
                titleBar.ForegroundColor = fg;
                titleBar.InactiveBackgroundColor = bg;
                titleBar.InactiveForegroundColor = inactive;
                titleBar.ButtonBackgroundColor = bg;
                titleBar.ButtonForegroundColor = fg;
                titleBar.ButtonHoverBackgroundColor = hoverBg;
                titleBar.ButtonHoverForegroundColor = fg;
                titleBar.ButtonPressedBackgroundColor = pressedBg;
                titleBar.ButtonPressedForegroundColor = fg;
                titleBar.ButtonInactiveBackgroundColor = bg;
                titleBar.ButtonInactiveForegroundColor = inactive;
            };
#endif

            return window;
        }

        private async Task CheckStoredAuthAsync()
        {
            try
            {
                if (await _auth.LoadStoredTokenAsync())
                {
                    var result = await _api.GetMeAsync();
                    _auth.User = result.User;

                    if (_auth.IsParent)
                        await Shell.Current.GoToAsync("//parent-dashboard");
                    else
                        await Shell.Current.GoToAsync("//kid-dashboard");
                    return;
                }
            }
            catch
            {
                // Token invalid or network error — show login
            }

            await Shell.Current.GoToAsync("//login");
        }
    }
}
