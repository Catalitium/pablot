#!/usr/bin/env python3
"""
SQL Query Builder - Interactive query generator
"""
import sys

class SQLBuilder:
    def __init__(self):
        self.query = {"type": "SELECT", "columns": ["*"], "table": "", "where": [], "order_by": [], "limit": None, "join": []}

    def select(self, *cols):
        self.query["columns"] = list(cols) if cols else ["*"]
        return self

    def from_table(self, table):
        self.query["table"] = table
        return self

    def join(self, table, on, join_type="INNER"):
        self.query["join"].append({"table": table, "on": on, "type": join_type})
        return self

    def where(self, cond):
        self.query["where"].append(cond)
        return self

    def order_by(self, col, direction="ASC"):
        self.query["order_by"].append({"column": col, "direction": direction})
        return self

    def limit(self, n):
        self.query["limit"] = n
        return self

    def build(self):
        q = self.query
        parts = []

        # SELECT
        cols = ", ".join(q["columns"])
        parts.append(f"SELECT {cols}")

        # FROM
        if q["table"]:
            parts.append(f"FROM {q['table']}")

        # JOIN
        for j in q["join"]:
            parts.append(f"{j['type']} JOIN {j['table']} ON {j['on']}")

        # WHERE
        if q["where"]:
            parts.append("WHERE " + " AND ".join(q["where"]))

        # ORDER BY
        if q["order_by"]:
            orders = [f"{o['column']} {o['direction']}" for o in q["order_by"]]
            parts.append("ORDER BY " + ", ".join(orders))

        # LIMIT
        if q["limit"]:
            parts.append(f"LIMIT {q['limit']}")

        return " ".join(parts) + ";"

def interactive():
    builder = SQLBuilder()
    print("SQL Query Builder - Type 'help' for commands\n")

    while True:
        try:
            cmd = input("sql> ").strip().lower()
        except EOFError:
            break

        if cmd in ("quit", "q", "exit"):
            break
        elif cmd == "help":
            print("""
Commands:
  SELECT <cols>     - Select columns (comma-separated)
  FROM <table>     - From table
  JOIN <table> ON <cond> - Join table
  WHERE <cond>     - Where condition
  ORDER BY <col> [ASC|DESC] - Order by
  LIMIT <n>        - Limit results
  BUILD            - Generate SQL
  RESET            - Start over
  HELP             - Show this help
            """)
        elif cmd == "build":
            print("\n" + builder.build() + "\n")
        elif cmd == "reset":
            builder = SQLBuilder()
            print("Reset.\n")
        elif cmd.startswith("select "):
            cols = [c.strip() for c in cmd[7:].split(",")]
            builder.select(*cols)
            print(f"Selected: {cols}")
        elif cmd.startswith("from "):
            builder.from_table(cmd[5:])
            print(f"From: {cmd[5:]}")
        elif cmd.startswith("where "):
            builder.where(cmd[6:])
            print(f"Added condition: {cmd[6:]}")
        elif cmd.startswith("order by "):
            parts = cmd[9:].rsplit(" ", 1)
            col = parts[0]
            direction = parts[1].upper() if len(parts) > 1 else "ASC"
            builder.order_by(col, direction)
            print(f"Order by: {col} {direction}")
        elif cmd.startswith("limit "):
            builder.limit(int(cmd[6:]))
            print(f"Limit: {cmd[6:]}")
        elif cmd.startswith("join "):
            # Simple parsing: JOIN table ON condition
            parts = cmd[5:].split(" ON ", 1)
            if len(parts) == 2:
                builder.join(parts[0].strip(), parts[1].strip())
                print(f"Join: {parts[0]} ON {parts[1]}")
        elif not cmd:
            pass
        else:
            print(f"Unknown: {cmd}")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="SQL Query Builder")
    parser.add_argument("-i", "--interactive", action="store_true")
    parser.add_argument("-t", "--table", help="Table name")
    parser.add_argument("-c", "--columns", help="Comma-separated columns")
    parser.add_argument("-w", "--where", help="Where condition")
    parser.add_argument("-o", "--order", help="Order by column")
    parser.add_argument("-l", "--limit", type=int, help="Limit")

    args = parser.parse_args()

    if args.interactive:
        interactive()
    else:
        builder = SQLBuilder()
        if args.table:
            builder = builder.from_table(args.table)
        if args.columns:
            builder = builder.select(*args.columns.split(","))
        if args.where:
            builder = builder.where(args.where)
        if args.order:
            builder = builder.order_by(args.order)
        if args.limit:
            builder = builder.limit(args.limit)
        print(builder.build())
