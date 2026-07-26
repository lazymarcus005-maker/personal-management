"use client";

import { useState, useRef, useTransition } from "react";
import { exportData, importData, previewImportData, type ImportPreview } from "@/lib/actions/data-transfer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Download, Upload, FileJson, CheckCircle2, AlertCircle, Loader2, Eye, ChevronDown, ChevronRight, X } from "lucide-react";

type StatusMessage = {
  type: "success" | "error";
  text: string;
} | null;

const CATEGORY_LABELS: Record<string, string> = {
  tags: "Tags",
  entityTags: "Entity Tags",
  paymentMethods: "Payment Methods",
  todos: "Todos",
  todoChecklistItems: "Checklist Items",
  financialItems: "Financial Items",
  financialOccurrences: "Occurrences",
  creditCards: "Credit Cards",
  creditCardStatements: "Statements",
  creditCardTransactions: "Transactions",
  notes: "Notes",
  reminders: "Reminders",
};

export default function DataTransferPage() {
  const [exportPending, setExportPending] = useState(false);
  const [importPending, startImportTransition] = useTransition();
  const [previewPending, startPreviewTransition] = useTransition();
  const [status, setStatus] = useState<StatusMessage>(null);
  const [importResult, setImportResult] = useState<Record<string, number> | null>(null);
  const [pendingJson, setPendingJson] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExportPending(true);
    setStatus(null);
    try {
      const data = await exportData();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `poj-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus({ type: "success", text: "Data exported successfully." });
    } catch (err) {
      setStatus({
        type: "error",
        text: err instanceof Error ? err.message : "Export failed.",
      });
    } finally {
      setExportPending(false);
    }
  };

  const resetPreview = () => {
    setPendingJson(null);
    setPreview(null);
    setExpandedCategories(new Set());
    setImportResult(null);
    setStatus(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus(null);
    setImportResult(null);
    setPreview(null);
    setExpandedCategories(new Set());

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text !== "string") {
        setStatus({ type: "error", text: "Could not read file." });
        return;
      }

      setPendingJson(text);
      startPreviewTransition(async () => {
        try {
          const result = await previewImportData(text);
          setPreview(result);
        } catch (err) {
          setStatus({
            type: "error",
            text: err instanceof Error ? err.message : "Failed to read file.",
          });
          setPendingJson(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      });
    };
    reader.readAsText(file);
  };

  const confirmImport = () => {
    if (!pendingJson) return;
    setStatus(null);
    startImportTransition(async () => {
      try {
        const result = await importData(pendingJson);
        setImportResult(result);
        setStatus({ type: "success", text: "Data imported successfully." });
        setPendingJson(null);
        setPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err) {
        setStatus({
          type: "error",
          text: err instanceof Error ? err.message : "Import failed.",
        });
      }
    });
  };

  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const totalImported = importResult
    ? Object.values(importResult).reduce((sum, n) => sum + n, 0)
    : 0;

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#7A847E]">
            Data
          </p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Export / Import
          </h1>
          <p className="mt-1 text-sm text-[#69736D]">
            Back up your data or restore from a previous backup.
          </p>
        </div>

        {status && (
          <div
            className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
              status.type === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {status.type === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{status.text}</span>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export Data
            </CardTitle>
            <CardDescription>
              Download all your data as a JSON file. Includes todos,
              subscriptions, bills, credit cards, notes, tags, and more.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExport} disabled={exportPending}>
              {exportPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Export All Data
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Data
            </CardTitle>
            <CardDescription>
              Upload a previously exported JSON file to restore your data.
              Existing records with the same ID will be skipped.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileSelect}
                className="block w-full text-sm text-[#69736D] file:mr-3 file:rounded-xl file:border-0 file:bg-[#18201C] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-[#2B352F] file:cursor-pointer cursor-pointer"
              />
            </div>

            {previewPending && (
              <div className="flex items-center gap-2 text-sm text-[#69736D]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Reading file...
              </div>
            )}

            {preview && !previewPending && (
              <div className="rounded-xl border border-[#E2E6E0] bg-[#FAFBF8] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#18201C]">
                    <Eye className="h-4 w-4" />
                    Import Preview ({preview.totalRecords} records)
                  </div>
                  <button
                    onClick={resetPreview}
                    className="rounded-md p-1 text-[#69736D] hover:bg-[#E2E6E0] hover:text-[#18201C]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-1 text-xs text-[#69736D]">
                  Version {preview.version} &middot; Exported{" "}
                  {new Date(preview.exportedAt).toLocaleString()}
                </p>

                <div className="mt-3 space-y-2">
                  {Object.entries(preview.categories).map(([key, cat]) => (
                    <div key={key} className="rounded-lg bg-white border border-[#E2E6E0]">
                      <button
                        onClick={() => toggleCategory(key)}
                        className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-[#F5F7F3] rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          {expandedCategories.has(key) ? (
                            <ChevronDown className="h-3.5 w-3.5 text-[#7A847E]" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-[#7A847E]" />
                          )}
                          <span className="text-[#18201C] font-medium capitalize">
                            {CATEGORY_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").trim()}
                          </span>
                        </div>
                        <span className="rounded-full bg-[#18201C] px-2 py-0.5 text-xs font-semibold text-white">
                          {cat.count}
                        </span>
                      </button>

                      {expandedCategories.has(key) && cat.samples.length > 0 && (
                        <div className="border-t border-[#E2E6E0] px-3 py-2">
                          <p className="mb-2 text-xs text-[#7A847E]">
                            Showing first {cat.samples.length} of {cat.count}
                          </p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr>
                                  {Object.keys(cat.samples[0]).map((field) => (
                                    <th
                                      key={field}
                                      className="px-2 py-1 text-left font-semibold text-[#69736D] whitespace-nowrap"
                                    >
                                      {field}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {cat.samples.map((row, i) => (
                                  <tr key={i} className="border-t border-[#E2E6E0]">
                                    {Object.values(row).map((val, j) => (
                                      <td
                                        key={j}
                                        className="px-2 py-1 text-[#18201C] max-w-[200px] truncate"
                                        title={String(val ?? "")}
                                      >
                                        {val === null ? (
                                          <span className="text-[#7A847E] italic">null</span>
                                        ) : typeof val === "boolean" ? (
                                          val ? "true" : "false"
                                        ) : (
                                          String(val)
                                        )}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {expandedCategories.has(key) && cat.samples.length === 0 && (
                        <div className="border-t border-[#E2E6E0] px-3 py-2 text-xs text-[#7A847E] italic">
                          No records
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex gap-2">
                  <Button onClick={confirmImport} disabled={importPending}>
                    {importPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Confirm Import
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={resetPreview} disabled={importPending}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {importResult && !importPending && (
              <div className="rounded-xl border border-[#E2E6E0] bg-[#FAFBF8] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#18201C]">
                  <FileJson className="h-4 w-4" />
                  Import Summary ({totalImported} records)
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                  {Object.entries(importResult).map(([key, count]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-lg bg-white px-3 py-2"
                    >
                      <span className="text-[#69736D] capitalize">
                        {CATEGORY_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").trim()}
                      </span>
                      <span className="font-semibold text-[#18201C]">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
