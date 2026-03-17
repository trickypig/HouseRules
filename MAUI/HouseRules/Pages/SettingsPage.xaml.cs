namespace HouseRules.Pages;

public partial class SettingsPage : ContentPage
{
    private readonly SettingsPageModel _viewModel;

    public SettingsPage(SettingsPageModel viewModel)
    {
        InitializeComponent();
        BindingContext = _viewModel = viewModel;
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();
        _viewModel.LoadDataCommand.Execute(null);
    }
}
