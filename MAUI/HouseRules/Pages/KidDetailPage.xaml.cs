namespace HouseRules.Pages;

public partial class KidDetailPage : ContentPage
{
    private bool? _isLandscape;

    public KidDetailPage(KidDetailPageModel viewModel)
    {
        InitializeComponent();
        BindingContext = viewModel;
    }

    protected override void OnSizeAllocated(double width, double height)
    {
        base.OnSizeAllocated(width, height);

        if (width <= 0 || height <= 0)
            return;

        var landscape = width > height;
        if (_isLandscape == landscape)
            return;

        _isLandscape = landscape;
        ApplyOrientation(GoalsRecurringGrid, RecurringPanel, landscape);
        ApplyOrientation(RecentFutureGrid, FuturePanel, landscape);
    }

    // Landscape: two columns side by side. Portrait: single column, second panel below.
    private static void ApplyOrientation(Grid grid, View secondPanel, bool landscape)
    {
        if (landscape)
        {
            grid.RowDefinitions.Clear();
            grid.ColumnDefinitions = new ColumnDefinitionCollection
            {
                new ColumnDefinition(GridLength.Star),
                new ColumnDefinition(GridLength.Star),
            };
            Grid.SetRow(secondPanel, 0);
            Grid.SetColumn(secondPanel, 1);
        }
        else
        {
            grid.ColumnDefinitions = new ColumnDefinitionCollection
            {
                new ColumnDefinition(GridLength.Star),
            };
            grid.RowDefinitions = new RowDefinitionCollection
            {
                new RowDefinition(GridLength.Auto),
                new RowDefinition(GridLength.Auto),
            };
            Grid.SetColumn(secondPanel, 0);
            Grid.SetRow(secondPanel, 1);
        }
    }
}
