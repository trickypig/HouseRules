namespace HouseRules.Pages;

public partial class KidDashboardPage : ContentPage
{
    private readonly KidDashboardPageModel _viewModel;

    public KidDashboardPage(KidDashboardPageModel viewModel)
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
