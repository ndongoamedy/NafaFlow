"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StatusBadge from "@/components/shared/StatusBadge";
import AmountFCFA from "@/components/shared/AmountFCFA";
import DateDisplay from "@/components/shared/DateDisplay";

interface QuoteLog {
  id: string;
  date: string;
  total: number;
  status: string;
}

interface InvoiceLog {
  id: string;
  date: string;
  total: number;
  status: string;
}

interface PaymentLog {
  id: string;
  date: string;
  amount: number;
  method: string;
  invoiceId: string;
}

interface ClientHistoryProps {
  quotes: QuoteLog[];
  invoices: InvoiceLog[];
  payments: PaymentLog[];
}

export default function ClientHistory({ quotes, invoices, payments }: ClientHistoryProps) {
  return (
    <Tabs defaultValue="invoices" className="w-full flex flex-col">
      <TabsList className="grid grid-cols-3 w-80 bg-slate-100 rounded-lg p-0.5 border border-slate-200/50 mb-4 shrink-0">
        <TabsTrigger value="invoices" className="text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-800">
          Factures
        </TabsTrigger>
        <TabsTrigger value="quotes" className="text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-800">
          Devis
        </TabsTrigger>
        <TabsTrigger value="payments" className="text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-800">
          Paiements
        </TabsTrigger>
      </TabsList>

      {/* Invoices Tab */}
      <TabsContent value="invoices">
        <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="text-slate-400 text-[10px] tracking-wider uppercase font-bold hover:bg-slate-50">
                <TableHead className="py-2.5 px-6">ID</TableHead>
                <TableHead className="py-2.5 px-6">Date d&apos;émission</TableHead>
                <TableHead className="py-2.5 px-6 text-right">Montant TTC</TableHead>
                <TableHead className="py-2.5 px-6 text-center">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 text-slate-700 text-sm">
              {invoices.length > 0 ? (
                invoices.map((inv) => (
                  <TableRow key={inv.id} className="hover:bg-slate-50/20">
                    <TableCell className="py-3 px-6 font-semibold text-slate-800">{inv.id}</TableCell>
                    <TableCell className="py-3 px-6"><DateDisplay date={inv.date} /></TableCell>
                    <TableCell className="py-3 px-6 text-right font-bold text-slate-800">
                      <AmountFCFA amount={inv.total} highlight />
                    </TableCell>
                    <TableCell className="py-3 px-6 text-center"><StatusBadge status={inv.status} /></TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-slate-400 font-medium">
                    Aucune facture émise pour ce client.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      {/* Quotes Tab */}
      <TabsContent value="quotes">
        <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="text-slate-400 text-[10px] tracking-wider uppercase font-bold hover:bg-slate-50">
                <TableHead className="py-2.5 px-6">ID</TableHead>
                <TableHead className="py-2.5 px-6">Date d&apos;émission</TableHead>
                <TableHead className="py-2.5 px-6 text-right">Montant TTC</TableHead>
                <TableHead className="py-2.5 px-6 text-center">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 text-slate-700 text-sm">
              {quotes.length > 0 ? (
                quotes.map((q) => (
                  <TableRow key={q.id} className="hover:bg-slate-50/20">
                    <TableCell className="py-3 px-6 font-semibold text-slate-800">{q.id}</TableCell>
                    <TableCell className="py-3 px-6"><DateDisplay date={q.date} /></TableCell>
                    <TableCell className="py-3 px-6 text-right font-bold text-slate-800">
                      <AmountFCFA amount={q.total} highlight />
                    </TableCell>
                    <TableCell className="py-3 px-6 text-center"><StatusBadge status={q.status} /></TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-slate-400 font-medium">
                    Aucun devis généré pour ce client.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      {/* Payments Tab */}
      <TabsContent value="payments">
        <div className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="text-slate-400 text-[10px] tracking-wider uppercase font-bold hover:bg-slate-50">
                <TableHead className="py-2.5 px-6">ID Virement</TableHead>
                <TableHead className="py-2.5 px-6">Date Paiement</TableHead>
                <TableHead className="py-2.5 px-6">Méthode</TableHead>
                <TableHead className="py-2.5 px-6">Rattaché à</TableHead>
                <TableHead className="py-2.5 px-6 text-right">Montant Encaissé</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 text-slate-700 text-sm">
              {payments.length > 0 ? (
                payments.map((p) => (
                  <TableRow key={p.id} className="hover:bg-slate-50/20">
                    <TableCell className="py-3 px-6 font-semibold text-slate-800">{p.id}</TableCell>
                    <TableCell className="py-3 px-6"><DateDisplay date={p.date} /></TableCell>
                    <TableCell className="py-3 px-6">
                      <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        {p.method}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 px-6 text-xs text-slate-500 font-semibold tabular-nums">{p.invoiceId}</TableCell>
                    <TableCell className="py-3 px-6 text-right font-bold text-emerald-600">
                      + <AmountFCFA amount={p.amount} className="text-emerald-600" />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-slate-400 font-medium">
                    Aucun paiement enregistré pour ce client.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>
    </Tabs>
  );
}
