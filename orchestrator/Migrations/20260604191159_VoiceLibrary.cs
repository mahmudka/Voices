using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace orchestrator.Migrations
{
    /// <inheritdoc />
    public partial class VoiceLibrary : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "VoiceType",
                table: "VoicePresets",
                newName: "Gender");

            migrationBuilder.RenameColumn(
                name: "Timbre",
                table: "VoicePresets",
                newName: "DefaultTimbre");

            migrationBuilder.RenameColumn(
                name: "Age",
                table: "VoicePresets",
                newName: "DefaultAge");

            migrationBuilder.AddColumn<int>(
                name: "AgeMax",
                table: "VoicePresets",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "AgeMin",
                table: "VoicePresets",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "VoicePresets",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Icon",
                table: "VoicePresets",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ModelFile",
                table: "VoicePresets",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "VoiceId",
                table: "VoicePresets",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "VoiceId",
                table: "Conversions",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_VoicePresets_VoiceId",
                table: "VoicePresets",
                column: "VoiceId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_VoicePresets_VoiceId",
                table: "VoicePresets");

            migrationBuilder.DropColumn(
                name: "AgeMax",
                table: "VoicePresets");

            migrationBuilder.DropColumn(
                name: "AgeMin",
                table: "VoicePresets");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "VoicePresets");

            migrationBuilder.DropColumn(
                name: "Icon",
                table: "VoicePresets");

            migrationBuilder.DropColumn(
                name: "ModelFile",
                table: "VoicePresets");

            migrationBuilder.DropColumn(
                name: "VoiceId",
                table: "VoicePresets");

            migrationBuilder.DropColumn(
                name: "VoiceId",
                table: "Conversions");

            migrationBuilder.RenameColumn(
                name: "Gender",
                table: "VoicePresets",
                newName: "VoiceType");

            migrationBuilder.RenameColumn(
                name: "DefaultTimbre",
                table: "VoicePresets",
                newName: "Timbre");

            migrationBuilder.RenameColumn(
                name: "DefaultAge",
                table: "VoicePresets",
                newName: "Age");
        }
    }
}
