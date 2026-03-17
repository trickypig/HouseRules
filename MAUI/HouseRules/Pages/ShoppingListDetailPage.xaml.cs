namespace HouseRules.Pages;

public partial class ShoppingListDetailPage : ContentPage
{
    public ShoppingListDetailPage(ShoppingListDetailPageModel viewModel)
    {
        InitializeComponent();
        BindingContext = viewModel;
    }
}
