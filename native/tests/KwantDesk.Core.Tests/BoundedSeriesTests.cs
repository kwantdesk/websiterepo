using KwantDesk.Core.Collections;

namespace KwantDesk.Core.Tests;

public sealed class BoundedSeriesTests
{
    [Fact]
    public void Add_OverCapacity_KeepsNewestValuesInOrder()
    {
        using var series = new BoundedSeries<int>(3);
        series.Add(1);
        series.Add(2);
        series.Add(3);
        series.Add(4);

        Assert.Equal([2, 3, 4], series.Snapshot());
        Assert.Equal(3, series.Count);
    }

    [Fact]
    public void ReplaceLast_UpdatesOnlyMostRecentValue()
    {
        using var series = new BoundedSeries<int>(3);
        series.Add(1);
        series.Add(2);

        Assert.True(series.ReplaceLast(20));
        Assert.Equal([1, 20], series.Snapshot());
    }

    [Fact]
    public void CopyNewestTo_UsesCallerBufferAndKeepsNewestValues()
    {
        using var series = new BoundedSeries<int>(5);
        foreach (var value in Enumerable.Range(1, 6)) series.Add(value);
        var destination = new int[3];

        var count = series.CopyNewestTo(destination);

        Assert.Equal(3, count);
        Assert.Equal([4, 5, 6], destination);
    }
}
