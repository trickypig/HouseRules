namespace HouseRules.Pages;

public partial class ShoppingListsPage : ContentPage
{
    private readonly ShoppingListsPageModel _viewModel;

    public ShoppingListsPage(ShoppingListsPageModel viewModel)
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
