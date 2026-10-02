import re
from collections import defaultdict

def group_inserts(input_file, output_file):
    with open(input_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    table_inserts = defaultdict(list)
    for line in lines:
        match = re.search(r"INSERT INTO ([\w\.]+) ", line)
        if match:
            table_name = match.group(1)
            # Add ON CONFLICT DO NOTHING to the insert statement
            # The line ends with );\n
            clean_line = line.strip().rstrip(';')
            modified_line = f"{clean_line} ON CONFLICT DO NOTHING;\n"
            table_inserts[table_name].append(modified_line)

    # Define a safe order for insertion
    safe_order = [
        "public.companies",
        "public.users",
        "public.stores",
        "public.customer_accounts",
        "public.product_categories",
        "public.products",
        "public.product_variants",
        "public.product_packaging_units",
        "public.customers",
        "public.account_bank_details",
        "public.account_directors",
        "public.account_suppliers",
        "public.orders",
        "public.order_items",
        "public.inventory_batches",
        "public.inventory_stock_allocations",
        "public.inventory_transactions",
        "public.payments",
        "public.expense_categories",
        "public.expenses",
        "public.projects",
        "public.project_expenses",
    ]
    
    remaining_tables = sorted([t for t in table_inserts.keys() if t not in safe_order])
    final_order = safe_order + remaining_tables

    with open(output_file, 'w', encoding='utf-8') as out:
        out.write("BEGIN;\n")
        
        for table in final_order:
            if table in table_inserts:
                out.write(f"-- Data for {table}\n")
                for insert in table_inserts[table]:
                    out.write(insert)
        
        out.write("COMMIT;\n")

if __name__ == "__main__":
    group_inserts("inserts_only.sql", "reordered_inserts.sql")
