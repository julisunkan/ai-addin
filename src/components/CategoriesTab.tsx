import { useState } from "react";
import {
  Search, Database, DollarSign, Calendar, Type, GitBranch,
  Grid, Table2, Zap, Code2, Star, ChevronDown, ChevronUp, ArrowRight
} from "lucide-react";

interface CategoryTemplate {
  label: string;
  prompt: string;
}

interface Category {
  id: string;
  icon: React.ReactNode;
  name: string;
  color: string;
  bgColor: string;
  borderColor: string;
  templates: CategoryTemplate[];
}

const CATEGORIES: Category[] = [
  {
    id: "lookup",
    icon: <Search className="w-4 h-4" />,
    name: "Lookup Formulas",
    color: "text-violet-700",
    bgColor: "bg-violet-50",
    borderColor: "border-violet-200",
    templates: [
      { label: "XLOOKUP with fallback", prompt: "Look up a value in a table using XLOOKUP and return a fallback value if not found" },
      { label: "VLOOKUP exact match", prompt: "Use VLOOKUP to find a product code in column A and return its price from column C" },
      { label: "INDEX/MATCH two-way", prompt: "Two-way lookup using INDEX and MATCH to find a value by both row and column headers" },
      { label: "Find and return from adjacent column", prompt: "Find a name in column B and return the corresponding value from column D" },
      { label: "Multiple criteria lookup", prompt: "Look up a value matching both a name in column A and a date in column B" },
    ],
  },
  {
    id: "financial",
    icon: <DollarSign className="w-4 h-4" />,
    name: "Financial Formulas",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    templates: [
      { label: "Monthly loan payment", prompt: "Calculate the monthly payment for a loan with principal, interest rate, and term" },
      { label: "Compound interest", prompt: "Calculate compound interest earned over time given principal, rate, and periods" },
      { label: "Net present value", prompt: "Calculate the net present value (NPV) of a series of future cash flows" },
      { label: "Internal rate of return", prompt: "Calculate the internal rate of return (IRR) for an investment with irregular cash flows" },
      { label: "Cumulative percentage", prompt: "Calculate what percentage each item is of the total, running cumulatively" },
    ],
  },
  {
    id: "dates",
    icon: <Calendar className="w-4 h-4" />,
    name: "Date Calculations",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    templates: [
      { label: "Working days between dates", prompt: "Calculate the number of working days (excluding weekends) between two dates" },
      { label: "Add months to a date", prompt: "Add a specific number of months to a date without changing the day" },
      { label: "Calculate age from birthdate", prompt: "Calculate a person's age in years from their date of birth" },
      { label: "Days until deadline", prompt: "Calculate how many days remain until a deadline date from today" },
      { label: "Quarter of the year", prompt: "Determine which fiscal quarter a date falls in" },
    ],
  },
  {
    id: "text",
    icon: <Type className="w-4 h-4" />,
    name: "Text Manipulation",
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    templates: [
      { label: "Extract first name", prompt: "Extract the first name from a full name where first and last are separated by a space" },
      { label: "Combine first and last name", prompt: "Combine a first name in column A and last name in column B into a full name" },
      { label: "Remove extra spaces", prompt: "Remove all leading, trailing, and extra spaces from a text string" },
      { label: "Extract domain from email", prompt: "Extract the domain name from an email address (the part after @)" },
      { label: "Capitalize each word", prompt: "Capitalize the first letter of each word in a text string" },
    ],
  },
  {
    id: "conditional",
    icon: <GitBranch className="w-4 h-4" />,
    name: "Conditional Formulas",
    color: "text-rose-700",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
    templates: [
      { label: "SUMIF with condition", prompt: "Sum values in column B only where the corresponding cell in column A equals 'Paid'" },
      { label: "COUNTIFS multiple criteria", prompt: "Count rows that meet multiple conditions: region is 'North' AND amount is over 1000" },
      { label: "Nested IF conditions", prompt: "Return 'High' if value > 100, 'Medium' if value > 50, otherwise 'Low'" },
      { label: "IFERROR catch errors", prompt: "Wrap a VLOOKUP formula with IFERROR to return 'Not Found' instead of an error" },
      { label: "Highlight overdue items", prompt: "Return TRUE if a date in column A is past today's date (overdue)" },
    ],
  },
  {
    id: "arrays",
    icon: <Grid className="w-4 h-4" />,
    name: "Dynamic Arrays",
    color: "text-cyan-700",
    bgColor: "bg-cyan-50",
    borderColor: "border-cyan-200",
    templates: [
      { label: "FILTER by condition", prompt: "Filter a list to show only rows where the status column says 'Active'" },
      { label: "SORT a range", prompt: "Sort a table by the third column in descending order" },
      { label: "UNIQUE values", prompt: "Get a list of unique values from a column that contains duplicates" },
      { label: "SEQUENCE a number list", prompt: "Generate a sequence of numbers from 1 to 100 in a column" },
      { label: "SORT and top N", prompt: "Return the top 5 values from a sales column" },
    ],
  },
  {
    id: "pivot",
    icon: <Table2 className="w-4 h-4" />,
    name: "Pivot & Table Helpers",
    color: "text-teal-700",
    bgColor: "bg-teal-50",
    borderColor: "border-teal-200",
    templates: [
      { label: "Running total", prompt: "Calculate a running total (cumulative sum) in a column as new rows are added" },
      { label: "Rank values", prompt: "Rank values in a column from highest to lowest, handling ties correctly" },
      { label: "GETPIVOTDATA extract", prompt: "Extract a specific value from a PivotTable using GETPIVOTDATA" },
      { label: "Subtotal visible rows", prompt: "Sum only the visible rows in a filtered table using SUBTOTAL" },
      { label: "Count per category", prompt: "Count how many times each unique category appears in a column" },
    ],
  },
  {
    id: "powerquery",
    icon: <Zap className="w-4 h-4" />,
    name: "Power Query Prompts",
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    templates: [
      { label: "Unpivot columns to rows", prompt: "Write a Power Query M formula to unpivot multiple month columns into a single rows column" },
      { label: "Merge two tables", prompt: "Write Power Query M code to merge two tables on a matching ID column" },
      { label: "Remove duplicate rows", prompt: "Write a Power Query step to remove duplicate rows based on a specific column" },
      { label: "Split column by delimiter", prompt: "Write Power Query M code to split a column by a comma delimiter into two columns" },
      { label: "Add conditional column", prompt: "Write Power Query M code to add a new column that returns 'High' if the Amount column is over 1000" },
    ],
  },
  {
    id: "vba",
    icon: <Code2 className="w-4 h-4" />,
    name: "VBA Snippets",
    color: "text-indigo-700",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200",
    templates: [
      { label: "Loop through all rows", prompt: "Write VBA code to loop through all rows in a table and process each row" },
      { label: "Copy sheet to new workbook", prompt: "Write VBA code to copy the active sheet to a new workbook and save it" },
      { label: "Auto-format table on open", prompt: "Write VBA code that runs when the workbook opens and formats a table in Sheet1" },
      { label: "Find and highlight cells", prompt: "Write VBA code to search for a specific value and highlight matching cells in yellow" },
      { label: "Export range to CSV", prompt: "Write VBA code to export a specific range of data to a CSV file" },
    ],
  },
  {
    id: "excel365",
    icon: <Star className="w-4 h-4" />,
    name: "Excel 365 Functions",
    color: "text-purple-700",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
    templates: [
      { label: "LAMBDA custom function", prompt: "Create a LAMBDA function that calculates the area of a rectangle given width and height" },
      { label: "LET for readability", prompt: "Use LET to store intermediate calculation values and make a complex formula readable" },
      { label: "MAP over a range", prompt: "Use MAP to apply a custom calculation to every cell in a range" },
      { label: "BYROW aggregate", prompt: "Use BYROW to calculate the sum of each row across multiple columns" },
      { label: "MAKEARRAY dynamic grid", prompt: "Use MAKEARRAY to create a multiplication table from 1 to 10" },
    ],
  },
];

interface CategoriesTabProps {
  onSelectTemplate: (prompt: string) => void;
  isLicensed: boolean;
}

export default function CategoriesTab({ onSelectTemplate, isLicensed }: CategoriesTabProps) {
  const [openCategory, setOpenCategory] = useState<string | null>("lookup");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = searchQuery.trim()
    ? CATEGORIES.map(cat => ({
        ...cat,
        templates: cat.templates.filter(t =>
          t.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
          cat.name.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter(cat => cat.templates.length > 0)
    : CATEGORIES;

  return (
    <div className="space-y-3 pb-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search templates…"
          className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-border bg-white focus:outline-none focus:border-indigo-400 transition-colors"
        />
      </div>

      <p className="text-[11px] text-muted-foreground">
        Click any template to load it into the Generate tab.
      </p>

      {/* Category list */}
      <div className="space-y-2">
        {filtered.map(cat => (
          <div
            key={cat.id}
            className={`rounded-xl border overflow-hidden ${cat.borderColor}`}
          >
            {/* Header */}
            <button
              onClick={() => setOpenCategory(openCategory === cat.id ? null : cat.id)}
              className={`w-full flex items-center justify-between px-3.5 py-3 ${cat.bgColor} hover:brightness-95 transition-all`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`${cat.color} opacity-80`}>{cat.icon}</span>
                <span className={`text-sm font-bold ${cat.color}`}>{cat.name}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/60 ${cat.color}`}>
                  {cat.templates.length}
                </span>
              </div>
              {openCategory === cat.id
                ? <ChevronUp className={`w-3.5 h-3.5 ${cat.color} opacity-70`} />
                : <ChevronDown className={`w-3.5 h-3.5 ${cat.color} opacity-70`} />}
            </button>

            {/* Templates */}
            {(openCategory === cat.id || searchQuery.trim()) && (
              <div className="divide-y divide-border">
                {cat.templates.map((tpl, i) => (
                  <button
                    key={i}
                    onClick={() => onSelectTemplate(tpl.prompt)}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 bg-white hover:bg-gray-50 transition-colors text-left group"
                  >
                    <ArrowRight className={`w-3 h-3 shrink-0 ${cat.color} opacity-50 group-hover:opacity-100 transition-opacity`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">{tpl.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{tpl.prompt}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Search className="w-6 h-6 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No templates match your search.</p>
        </div>
      )}
    </div>
  );
}
