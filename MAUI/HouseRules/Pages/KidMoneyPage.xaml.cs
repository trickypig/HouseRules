using Syncfusion.Maui.Toolkit.Charts;

namespace HouseRules.Pages;

public partial class KidMoneyPage : ContentPage
{
    private readonly KidMoneyPageModel _viewModel;

    public KidMoneyPage(KidMoneyPageModel viewModel)
    {
        InitializeComponent();
        BindingContext = _viewModel = viewModel;
        _viewModel.PropertyChanged += OnViewModelPropertyChanged;
        BalanceChart.TrackballCreated += OnTrackballCreated;
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();
        _viewModel.LoadDataCommand.Execute(null);
    }

    private void OnTrackballCreated(object? sender, TrackballEventArgs e)
    {
        BalanceChartPoint? dataPoint = null;

        // Find the data item from any point and hide individual series labels
        foreach (var info in e.TrackballPointsInfo)
        {
            if (info.DataItem is BalanceChartPoint pt)
                dataPoint = pt;
            info.Label = string.Empty;
        }

        if (dataPoint == null || e.TrackballPointsInfo.Count == 0) return;

        // Show one combined label on the last (balance line) point
        var balanceInfo = e.TrackballPointsInfo[^1];
        var prevBalance = dataPoint.Balance + dataPoint.DebitHigh - dataPoint.CreditLow
            == dataPoint.Balance ? dataPoint.CreditLow
            : dataPoint.Balance + (dataPoint.DebitHigh - dataPoint.DebitLow) - (dataPoint.CreditHigh - dataPoint.CreditLow);
        // Simpler: prev balance = balance + debits - credits
        var credits = dataPoint.CreditHigh - dataPoint.CreditLow;
        var debits = dataPoint.DebitHigh - dataPoint.DebitLow;
        var prev = dataPoint.Balance + debits - credits;

        balanceInfo.Label = $"Prev Week: {prev:C2}\nEarned: {credits:C2}\nSpent: {debits:C2}\nBalance: {dataPoint.Balance:C2}";
    }

    private void OnViewModelPropertyChanged(object? sender, System.ComponentModel.PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(KidMoneyPageModel.IsBusy) && !_viewModel.IsBusy)
            UpdateGoalAnnotations();
    }

    private void UpdateGoalAnnotations()
    {
        BalanceChart.Annotations.Clear();

        var colors = new[] { "#00F0FF", "#FFFF00", "#B026FF", "#FF6B00", "#39FF14" };
        int colorIdx = 0;

        foreach (var goal in _viewModel.Goals)
        {
            if (goal.TargetAmount is not > 0) continue;

            var color = Color.FromArgb(colors[colorIdx % colors.Length]);
            colorIdx++;

            BalanceChart.Annotations.Add(new HorizontalLineAnnotation
            {
                Y1 = (double)goal.TargetAmount.Value,
                Stroke = color,
                StrokeWidth = 1.5,
                StrokeDashArray = [5, 3],
                Text = $"{goal.Name}: {goal.TargetAmount:C0}",
                LabelStyle = new ChartAnnotationLabelStyle
                {
                    FontSize = 10,
                    TextColor = color,
                    HorizontalTextAlignment = ChartLabelAlignment.End,
                    VerticalTextAlignment = ChartLabelAlignment.Start
                }
            });
        }
    }
}
