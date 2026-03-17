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
