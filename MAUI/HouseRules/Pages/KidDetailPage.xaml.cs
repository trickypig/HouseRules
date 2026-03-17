namespace HouseRules.Pages;

public partial class KidDetailPage : ContentPage
{
    public KidDetailPage(KidDetailPageModel viewModel)
    {
        InitializeComponent();
        BindingContext = viewModel;
    }
}
