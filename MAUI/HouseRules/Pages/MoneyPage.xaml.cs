namespace HouseRules.Pages;

public partial class MoneyPage : ContentPage
{
    private readonly MoneyPageModel _viewModel;

    public MoneyPage(MoneyPageModel viewModel)
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
