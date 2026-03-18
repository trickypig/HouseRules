namespace HouseRules.Pages;

public partial class KidMoneyPage : ContentPage
{
    private readonly KidMoneyPageModel _viewModel;

    public KidMoneyPage(KidMoneyPageModel viewModel)
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
