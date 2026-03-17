#!/usr/bin/env python3
"""
API Tester - Rich Terminal API Testing Tool
Beautiful CLI for testing REST APIs with syntax highlighting
"""
import sys
import json
import argparse
import urllib.request
import urllib.error
import urllib.parse
import time
from datetime import datetime
from pathlib import Path

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.syntax import Syntax
    from rich.table import Table
    from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
    from rich.json import JSON
    from rich.tree import Tree
    console = Console()
    RICH = True
except ImportError:
    RICH = False
    console = print

class APITester:
    def __init__(self, base_url="", headers=None):
        self.base_url = base_url.rstrip('/')
        self.headers = headers or {}
        self.history = []
        self.session_start = datetime.now()

    def request(self, method, endpoint, data=None, params=None):
        url = f"{self.base_url}{endpoint}"
        if params:
            url += '?' + urllib.parse.urlencode(params)

        req = urllib.request.Request(url, method=method)
        for k, v in self.headers.items():
            req.add_header(k, v)

        if data:
            if isinstance(data, dict):
                data = json.dumps(data).encode()
                req.add_header('Content-Type', 'application/json')
            elif isinstance(data, str):
                data = data.encode()
            req.data = data

        start = time.time()
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read().decode()
                elapsed = time.time() - start
                try:
                    response_data = json.loads(body)
                except:
                    response_data = body

                result = {
                    'status': resp.status,
                    'headers': dict(resp.headers),
                    'data': response_data,
                    'time': elapsed
                }
        except urllib.error.HTTPError as e:
            elapsed = time.time() - start
            result = {
                'status': e.code,
                'headers': dict(e.headers),
                'data': e.read().decode() if e.fp else '',
                'time': elapsed,
                'error': str(e)
            }
        except Exception as e:
            elapsed = time.time() - start
            result = {
                'status': 0,
                'error': str(e),
                'time': elapsed
            }

        self.history.append({
            'method': method,
            'endpoint': endpoint,
            'url': url,
            'result': result,
            'timestamp': datetime.now()
        })

        return result

    def get(self, endpoint, **kwargs):
        return self.request('GET', endpoint, **kwargs)

    def post(self, endpoint, data=None, **kwargs):
        return self.request('POST', endpoint, data=data, **kwargs)

    def put(self, endpoint, data=None, **kwargs):
        return self.request('PUT', endpoint, data=data, **kwargs)

    def delete(self, endpoint, **kwargs):
        return self.request('DELETE', endpoint, **kwargs)

def format_response(result):
    if RICH:
        status = result.get('status', 0)
        if status >= 200 and status < 300:
            status_str = f"[green]{status} OK[/green]"
        elif status >= 400:
            status_str = f"[red]{status} ERROR[/red]"
        else:
            status_str = f"[yellow]{status}[/yellow]"

        console.print(Panel(
            f"Status: {status_str}\nTime: {result.get('time', 0)*1000:.1f}ms",
            border_style="cyan",
            padding=(0, 1)
        ))

        if 'error' in result:
            console.print(f"[red]Error:[/red] {result['error']}")
            return

        data = result.get('data', '')
        if isinstance(data, dict):
            json_str = json.dumps(data, indent=2)
            syntax = Syntax(json_str, "json", theme="monokai", line_numbers=False)
            console.print(Panel(syntax, title="Response Body", border_style="green", padding=1))
        else:
            console.print(data)

        if result.get('headers'):
            console.print("\n[bold]Response Headers:[/bold]")
            for k, v in list(result['headers'].items())[:5]:
                console.print(f"  [cyan]{k}:[/cyan] {v}")
    else:
        status = result.get('status', 0)
        print(f"Status: {status} | Time: {result.get('time', 0)*1000:.1f}ms")
        if 'error' in result:
            print(f"Error: {result['error']}")
        else:
            print(result.get('data', ''))

def interactive_mode(base_url=""):
    api = APITester(base_url)

    if RICH:
        console.print(Panel(
            "[bold cyan]API Tester[/bold cyan]\n"
            "Commands: GET, POST, PUT, DELETE, SET, HISTORY, HELP, QUIT",
            border_style="cyan",
            padding=(1, 2)
        ))
    else:
        print("=== API Tester ===")
        print("Commands: GET, POST, PUT, DELETE, SET, HISTORY, HELP, QUIT")

    while True:
        try:
            cmd = input(f"\n[{api.base_url}]> ").strip()
        except (EOFError, KeyboardInterrupt):
            break

        if not cmd:
            continue

        parts = cmd.split(maxsplit=2)
        method = parts[0].upper()
        endpoint = parts[1] if len(parts) > 1 else ''
        body = parts[2] if len(parts) > 2 else None

        if method in ('GET', 'POST', 'PUT', 'DELETE'):
            try:
                data = json.loads(body) if body else None
            except:
                data = body

            if RICH:
                with console.status(f"[cyan]{method} {endpoint}..."):
                    result = api.request(method, endpoint, data)
                format_response(result)
            else:
                result = api.request(method, endpoint, data)
                format_response(result)

        elif method == 'SET':
            if endpoint:
                api.base_url = endpoint.rstrip('/')
                console.print(f"[green]Base URL set to: {api.base_url}[/green]") if RICH else print(f"Base URL: {api.base_url}")
            else:
                console.print("[yellow]Usage: SET <base_url>[/yellow]") if RICH else print("Usage: SET <base_url>")

        elif method == 'HISTORY':
            if RICH:
                table = Table(show_header=True)
                table.add_column("#", style="cyan")
                table.add_column("Method")
                table.add_column("Endpoint")
                table.add_column("Status")
                for i, h in enumerate(api.history[-10:], 1):
                    status = h['result'].get('status', 0)
                    table.add_row(str(i), h['method'], h['endpoint'], str(status))
                console.print(table)
            else:
                for i, h in enumerate(api.history[-10:], 1):
                    print(f"{i}. {h['method']} {h['endpoint']} -> {h['result'].get('status', 'error')}")

        elif method == 'HELP':
            if RICH:
                console.print("""
[bold]Commands:[/bold]
  GET <endpoint>           - Send GET request
  POST <endpoint> [data]  - Send POST request with JSON body
  PUT <endpoint> [data]   - Send PUT request
  DELETE <endpoint>       - Send DELETE request
  SET <url>               - Set base URL
  HISTORY                 - Show request history
  QUIT                    - Exit
                """)
            else:
                print("GET, POST, PUT, DELETE, SET, HISTORY, HELP, QUIT")

        elif method in ('QUIT', 'Q', 'EXIT'):
            break

        else:
            console.print(f"[red]Unknown command: {method}[/red]") if RICH else print(f"Unknown: {method}")

    duration = datetime.now() - api.session_start
    if RICH:
        console.print(f"\n[dim]Session ended. {len(api.history)} requests in {duration.total_seconds():.1f}s[/dim]")
    else:
        print(f"Session ended. {len(api.history)} requests in {duration.total_seconds():.1f}s")

def main():
    parser = argparse.ArgumentParser(description="API Tester - Beautiful REST API testing")
    parser.add_argument("endpoint", nargs="?", help="Endpoint to test")
    parser.add_argument("-m", "--method", default="GET", help="HTTP method")
    parser.add_argument("-d", "--data", help="Request body (JSON)")
    parser.add_argument("-H", "--header", action="append", help="Add header")
    parser.add_argument("-b", "--base-url", default="", help="Base URL")
    parser.add_argument("-i", "--interactive", action="store_true", help="Interactive mode")

    args = parser.parse_args()

    headers = {}
    if args.header:
        for h in args.header:
            if ':' in h:
                k, v = h.split(':', 1)
                headers[k.strip()] = v.strip()

    if args.interactive or not args.endpoint:
        interactive_mode(args.base_url)
        return

    api = APITester(args.base_url, headers)

    try:
        data = json.loads(args.data) if args.data else None
    except:
        data = args.data

    if RICH:
        with console.status(f"[cyan]{args.method} {args.endpoint}..."):
            result = api.request(args.method, args.endpoint, data)
        format_response(result)
    else:
        result = api.request(args.method, args.endpoint, data)
        format_response(result)

if __name__ == "__main__":
    main()
