namespace HouseRules.Models;

public class User
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string FamilyDisplayName { get; set; } = string.Empty;
    public int IsAdmin { get; set; }
    public string Role { get; set; } = "parent";
    public int? ParentId { get; set; }
    public int? KidId { get; set; }
    public int? HouseholdId { get; set; }
}

public class Household
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string InviteCode { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;
}

public class HouseholdMember
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string FamilyDisplayName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
}
