#!/usr/bin/env python3
"""
Rich CLI Prompt Tester - Python with rich formatting
A polished terminal UI for testing LLM prompts
"""
import sys
import argparse
import json
from datetime import datetime
from pathlib import Path

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.syntax import Syntax
    from rich.markdown import Markdown
    from rich.table import Table
    from rich.prompt import Prompt, Confirm
    from rich.progress import Progress, SpinnerColumn, TextColumn
    console = Console()
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False
    console = None

# Fallback without rich
def simple_print(msg, style=""):
    print(msg)

class PromptTester:
    def __init__(self):
        self.history = []
        self.current_prompt = ""
        self.current_system = ""

    def banner(self):
        if RICH_AVAILABLE:
            console.print(Panel(
                "[bold green]LLM Prompt Tester[/bold green]\n"
                "Interactive prompt engineering tool",
                border_style="green",
                padding=(1, 2)
            ))
        else:
            print("=== LLM Prompt Tester ===")

    def menu(self):
        if RICH_AVAILABLE:
            table = Table(show_header=True, header_style="bold magenta")
            table.add_column("Option", style="cyan")
            table.add_column("Description")
            table.add_row("1", "Test prompt")
            table.add_row("2", "System prompt editor")
            table.add_row("3", "View history")
            table.add_row("4", "Load preset")
            table.add_row("5", "Export prompts")
            table.add_row("q", "Quit")
            console.print(table)
        else:
            print("1. Test prompt")
            print("2. System prompt editor")
            print("3. View history")
            print("4. Load preset")
            print("5. Export prompts")
            print("q. Quit")

    def test_prompt(self):
        if RICH_AVAILABLE:
            console.print("\n[bold cyan]Enter your test input:[/bold cyan]")
        user_input = input("> ")

        if RICH_AVAILABLE:
            console.print("\n[bold green]System Prompt:[/bold green]")
            if self.current_system:
                console.print(Panel(self.current_system, border_style="blue"))
            else:
                console.print("[dim]No system prompt set[/dim]")

            console.print("\n[bold green]User Prompt:[/bold green]")
            console.print(Panel(user_input, border_style="green"))

            # Show token estimate
            total = len(self.current_system) + len(user_input)
            tokens = total // 4
            console.print(f"\n[dim]Estimated tokens: ~{tokens}[/dim]")
            console.print(f"[dim]Estimated cost (GPT-4): ${tokens * 0.03 / 1000:.4f}[/dim]")
        else:
            print(f"\nSystem: {self.current_system or '(none)'}")
            print(f"Input: {user_input}")
            print(f"Tokens: ~{(len(self.current_system) + len(user_input)) // 4}")

        # Simulate response (in real version, call LLM API)
        response = f"[Simulated response to: {user_input[:30]}...]"

        if RICH_AVAILABLE:
            console.print("\n[bold yellow]Response:[/bold yellow]")
            console.print(Panel(response, border_style="yellow", padding=(1, 2)))
        else:
            print(f"\nResponse: {response}")

        self.history.append({
            "timestamp": datetime.now().isoformat(),
            "system": self.current_system,
            "input": user_input,
            "response": response
        })

    def edit_system(self):
        if RICH_AVAILABLE:
            console.print("\n[bold cyan]Enter system prompt (Ctrl+D to finish):[/bold cyan]")
        else:
            print("\nEnter system prompt (Ctrl+D to finish):")

        try:
            lines = []
            while True:
                try:
                    line = input()
                    lines.append(line)
                except EOFError:
                    break
            self.current_system = "\n".join(lines)
            if RICH_AVAILABLE:
                console.print(f"[green]System prompt updated ({len(self.current_system)} chars)[/green]")
            else:
                print(f"System prompt updated ({len(self.current_system)} chars)")
        except KeyboardInterrupt:
            pass

    def show_history(self):
        if not self.history:
            if RICH_AVAILABLE:
                console.print("[dim]No history yet[/dim]")
            else:
                print("No history yet")
            return

        if RICH_AVAILABLE:
            table = Table(show_header=True)
            table.add_column("#", style="cyan")
            table.add_column("Time")
            table.add_column("Input", style="green")

            for i, entry in enumerate(self.history[-10:], 1):
                ts = entry["timestamp"].split("T")[1][:8]
                table.add_row(str(i), ts, entry["input"][:40] + "...")

            console.print(table)
        else:
            for i, entry in enumerate(self.history, 1):
                print(f"{i}. {entry['timestamp']} - {entry['input'][:40]}")

    def load_preset(self):
        presets = {
            "1": {"name": "Concise", "system": "Answer briefly and directly. No unnecessary words."},
            "2": {"name": "Detailed", "system": "Provide thorough, well-structured answers with examples."},
            "3": {"name": "Socratic", "system": "Help me think by asking questions. Don't give direct answers."},
            "4": {"name": "Code Review", "system": "Review code for bugs, performance, and best practices."},
            "5": {"name": "ELI5", "system": "Explain like I'm 5. Use simple words and analogies."},
        }

        if RICH_AVAILABLE:
            table = Table(show_header=True)
            table.add_column("Key", style="cyan")
            table.add_column("Preset")
            for k, v in presets.items():
                table.add_row(k, v["name"])
            console.print(table)

            choice = Prompt.ask("Select preset", choices=list(presets.keys()), default="1")
        else:
            for k, v in presets.items():
                print(f"{k}. {v['name']}")
            choice = input("Select: ")

        if choice in presets:
            self.current_system = presets[choice]["system"]
            if RICH_AVAILABLE:
                console.print(f"[green]Loaded: {presets[choice]['name']}[/green]")
            else:
                print(f"Loaded: {presets[choice]['name']}")

    def export_prompts(self):
        data = {
            "system_prompt": self.current_system,
            "history": self.history,
            "exported": datetime.now().isoformat()
        }

        filename = f"prompts-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"

        if RICH_AVAILABLE:
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                console=console
            ) as progress:
                progress.add_task("Exporting...", total=None)
                Path(filename).write_text(json.dumps(data, indent=2))

            console.print(f"[green]Exported to: {filename}[/green]")
        else:
            Path(filename).write_text(json.dumps(data, indent=2))
            print(f"Exported to: {filename}")

    def run(self):
        self.banner()

        while True:
            self.menu()
            choice = input("\n> ").strip().lower()

            if choice == "1":
                self.test_prompt()
            elif choice == "2":
                self.edit_system()
            elif choice == "3":
                self.show_history()
            elif choice == "4":
                self.load_preset()
            elif choice == "5":
                self.export_prompts()
            elif choice == "q":
                if RICH_AVAILABLE:
                    console.print("[bold red]Goodbye![/bold red]")
                else:
                    print("Goodbye!")
                break
            else:
                print("Invalid option")

def main():
    tester = PromptTester()
    tester.run()

if __name__ == "__main__":
    main()
