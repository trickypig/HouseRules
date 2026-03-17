namespace HouseRules.Pages;

public partial class DashboardPage : ContentPage
{
    private readonly DashboardPageModel _viewModel;

    public DashboardPage(DashboardPageModel viewModel)
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
