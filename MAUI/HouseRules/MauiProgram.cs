using CommunityToolkit.Maui;
using Microsoft.Extensions.Logging;
using Syncfusion.Maui.Toolkit.Hosting;

namespace HouseRules
{
    public static class MauiProgram
    {
        public static MauiApp CreateMauiApp()
        {
            var builder = MauiApp.CreateBuilder();
            builder
                .UseMauiApp<App>()
                .UseMauiCommunityToolkit(options =>
                {
#if WINDOWS
                    options.SetShouldEnableSnackbarOnWindows(true);
#endif
                })
                .ConfigureSyncfusionToolkit()
                .ConfigureMauiHandlers(handlers =>
                {
#if WINDOWS
    				Microsoft.Maui.Controls.Handlers.Items.CollectionViewHandler.Mapper.AppendToMapping("KeyboardAccessibleCollectionView", (handler, view) =>
    				{
    					handler.PlatformView.SingleSelectionFollowsFocus = false;
    				});
#endif
                })
                .ConfigureFonts(fonts =>
                {
                    fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
                    fonts.AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold");
                    fonts.AddFont("SegoeUI-Semibold.ttf", "SegoeSemibold");
                    fonts.AddFont("FluentSystemIcons-Regular.ttf", FluentUI.FontFamily);
                });

#if DEBUG
    		builder.Logging.AddDebug();
    		builder.Services.AddLogging(configure => configure.AddDebug());
#endif

            // Core services
            builder.Services.AddSingleton<AuthService>();
            builder.Services.AddSingleton<HttpClient>();
            builder.Services.AddSingleton<ApiClient>();

            // Parent pages
            builder.Services.AddTransient<LoginPage>();
            builder.Services.AddTransient<LoginPageModel>();
            builder.Services.AddTransient<RegisterPage>();
            builder.Services.AddTransient<RegisterPageModel>();
            builder.Services.AddTransient<DashboardPage>();
            builder.Services.AddTransient<DashboardPageModel>();
            builder.Services.AddTransient<MoneyPage>();
            builder.Services.AddTransient<MoneyPageModel>();
            builder.Services.AddTransient<KidDetailPage>();
            builder.Services.AddTransient<KidDetailPageModel>();
            builder.Services.AddTransient<TransactionFormPage>();
            builder.Services.AddTransient<TransactionFormPageModel>();
            builder.Services.AddTransient<ChoreBoardPage>();
            builder.Services.AddTransient<ChoreBoardPageModel>();
            builder.Services.AddTransient<ShoppingListsPage>();
            builder.Services.AddTransient<ShoppingListsPageModel>();
            builder.Services.AddTransient<ShoppingListDetailPage>();
            builder.Services.AddTransient<ShoppingListDetailPageModel>();
            builder.Services.AddTransient<SettingsPage>();
            builder.Services.AddTransient<SettingsPageModel>();

            // Kid pages
            builder.Services.AddTransient<KidDashboardPage>();
            builder.Services.AddTransient<KidDashboardPageModel>();
            builder.Services.AddTransient<KidMoneyPage>();
            builder.Services.AddTransient<KidMoneyPageModel>();
            builder.Services.AddTransient<KidChoresPage>();
            builder.Services.AddTransient<KidChoresPageModel>();

            return builder.Build();
        }
    }
}
