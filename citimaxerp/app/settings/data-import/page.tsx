"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PermissionGuard } from "@/components/PermissionGuard"
import { useToast } from "@/hooks/use-toast"
import { Download, ExternalLink, Info, Loader2, Upload } from "lucide-react"
import { ImportSchema, describeType, downloadTemplate, fetchImportSchemas } from "@/lib/data-import"
import { ImportDialog } from "./components/import-dialog"

// Products already has its own importer on the products page, but the migration only makes sense as
// one ordered list, so it appears here in sequence as a link rather than being rebuilt.
const PRODUCTS_STEP = {
  order: 3,
  label: "Products",
  description: "Your item list, with sizes, costs and tax status. Opening stock and purchase orders both refer to products by Item No., so bring these across before either of them.",
  href: "/inventory/products",
}

export default function DataImportPage() {
  const [schemas, setSchemas] = useState<ImportSchema[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<ImportSchema | null>(null)
  const { toast } = useToast()

  const load = () => {
    setLoading(true)
    fetchImportSchemas()
      .then((all) => setSchemas(all.filter((s) => (s.context ?? "hub") === "hub")))
      .catch((error: any) =>
        toast({ title: "Could not load the import formats", description: error.message, variant: "destructive" })
      )
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const steps = [...schemas, PRODUCTS_STEP as unknown as ImportSchema].sort((a, b) => a.order - b.order)

  return (
    <PermissionGuard
      permissions={["can_manage_system", "can_manage_company", "can_create_suppliers", "can_create_customers", "can_adjust_closing_stock", "can_create_purchase_orders"]}
    >
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Import</h1>
        <p className="mt-1 text-gray-600">Move your records across from your previous system.</p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>How this works</AlertTitle>
        <AlertDescription>
          For each step below, download the template, paste your old data under the headings it already has, then upload
          it back. Every upload is previewed first and shows you row by row what it will do &mdash; nothing is saved
          until you confirm. Work down the list in order, because the later sheets refer to records created by the
          earlier ones. Purchase orders are not here &mdash; you load those from a spreadsheet inside the{" "}
          <Link href="/purchase-orders" className="font-medium underline underline-offset-2">New Purchase Order</Link> form.
        </AlertDescription>
      </Alert>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading the import formats...
        </div>
      ) : (
        <div className="space-y-4">
          {steps.map((step, index) => (
            <Card key={step.key ?? step.label}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="mt-0.5 shrink-0 rounded-full px-2.5">{index + 1}</Badge>
                    <div>
                      <CardTitle>{step.label}</CardTitle>
                      <CardDescription className="mt-1">{step.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {step.key ? (
                      <>
                        <Button variant="outline" size="sm" onClick={() => downloadTemplate(step)}>
                          <Download className="mr-2 h-4 w-4" />
                          Template
                        </Button>
                        <PermissionGuard permissions={[step.permission, "can_manage_system", "can_manage_company"]} hideOnDenied>
                          <Button size="sm" onClick={() => setActive(step)}>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload
                          </Button>
                        </PermissionGuard>
                      </>
                    ) : (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={PRODUCTS_STEP.href}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Go to Products
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              {step.key && (
                <CardContent className="pt-0">
                  <p className="mb-3 text-sm text-gray-600">{step.matching}</p>
                  <Accordion type="single" collapsible>
                    <AccordionItem value="format" className="border-b-0">
                      <AccordionTrigger className="py-2 text-sm">
                        Accepted format ({step.columns.length} columns)
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="overflow-hidden rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Column</TableHead>
                                <TableHead className="w-24">Required</TableHead>
                                <TableHead className="w-48">Accepted values</TableHead>
                                <TableHead className="w-40">Example</TableHead>
                                <TableHead>Notes</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {step.columns.map((column) => (
                                <TableRow key={column.key}>
                                  <TableCell className="font-medium">{column.label}</TableCell>
                                  <TableCell>
                                    {column.required ? (
                                      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">Required</Badge>
                                    ) : (
                                      <span className="text-gray-400">Optional</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-sm text-gray-600">{describeType(column)}</TableCell>
                                  <TableCell className="text-sm text-gray-500">{column.example || "-"}</TableCell>
                                  <TableCell className="text-sm text-gray-600">{column.help ?? ""}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <ImportDialog schema={active} onClose={() => setActive(null)} onImported={load} />
    </div>
    </PermissionGuard>
  )
}
