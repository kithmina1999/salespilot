import { useState, useMemo } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { RuleEntry } from '@/hooks/useRulesPage';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Edit2, Trash2, Search, Power, PowerOff, Bot, ExternalLink, Eye } from 'lucide-react';
import Link from 'next/link';

interface RulesDataTableProps {
  data: RuleEntry[];
  onView: (rule: RuleEntry) => void;
  onEdit: (rule: RuleEntry) => void;
  onDelete: (id: number) => void;
  onToggleStatus: (rule: RuleEntry) => void;
  selectedCategory: string | null;
  botReplyLang?: string;
  onOpenSimulator?: () => void;
}

export function RulesDataTable({ data, onView, onEdit, onDelete, onToggleStatus, selectedCategory, botReplyLang = 'en', onOpenSimulator }: RulesDataTableProps) {
  const [globalFilter, setGlobalFilter] = useState('');

  const filteredData = useMemo(() => {
    if (!selectedCategory || selectedCategory === 'All') return data;
    return data.filter(rule => (rule.category || 'General') === selectedCategory);
  }, [data, selectedCategory]);

  const columns: ColumnDef<RuleEntry>[] = [
    {
      accessorKey: 'knowledge_type',
      header: 'Type',
      cell: ({ row }) => {
        const rule = row.original;
        let badgeColor = 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
        let label = 'FAQ';

        if (rule.knowledge_type === 'product_catalog') {
          badgeColor = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
          label = 'Product';
        } else if (rule.source_type === 'payment_settings') {
          badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
          label = 'Payment';
        } else if (rule.source_type === 'delivery_settings') {
          badgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
          label = 'Delivery';
        }

        return (
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={`text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 ${badgeColor}`}>
              {label}
            </Badge>
            {rule.system_managed && (
              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-zinc-800 text-zinc-400 border-zinc-700 font-mono">
                System
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'keywords',
      header: 'Trigger Keywords',
      cell: ({ row }) => {
        const kws = (row.getValue('keywords') as string).split(',').map(k => k.trim());
        return (
	          <div className="flex flex-wrap gap-1 max-w-[360px]">
            {kws.slice(0, 3).map((kw, i) => (
              <Badge key={i} variant="outline" className="text-xs font-mono bg-muted border-border text-muted-foreground">
                {kw}
              </Badge>
            ))}
            {kws.length > 3 && (
              <Badge variant="outline" className="text-xs font-mono bg-muted border-border text-muted-foreground">
                +{kws.length - 3}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'responses',
      header: 'Response Preview',
      cell: ({ row }) => {
        const rule = row.original;
        let parsed: Record<string, string> = {};
        try {
          parsed = JSON.parse(rule.responses || '{}');
        } catch {}

        const hasEn = !!parsed['en'] || !!rule.response;
        const hasSi = !!parsed['si'] || !!rule.sinhala_response;
        const previewText = parsed[botReplyLang] || parsed['en'] || rule.response || rule.sinhala_response || 'No response configured';

        return (
          <div className="flex items-center gap-2">
	            <div className="max-w-[460px] truncate text-sm text-muted-foreground">
              {previewText}
            </div>
            <div className="flex gap-1 shrink-0">
              {hasEn && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-blue-500/10 text-blue-400 border-blue-500/20 font-bold uppercase tracking-wider">EN</Badge>}
              {hasSi && <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-green-500/10 text-green-400 border-green-500/20 font-bold uppercase tracking-wider">SI</Badge>}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'usage_count',
      header: 'Hits',
      cell: ({ row }) => <span className="font-mono text-muted-foreground">{row.getValue('usage_count') || 0}</span>,
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => {
        const isActive = row.getValue('is_active') as boolean;
        return (
          <Badge variant="outline" className={isActive ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-secondary text-muted-foreground border-border'}>
            {isActive ? 'Active' : 'Paused'}
          </Badge>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const rule = row.original;

        if (rule.system_managed) {
          let sourceLink = '/dashboard';
          let sourceLabel = 'Edit Source';
	          if (rule.source_type === 'product') {
	            sourceLink = '/dashboard/products';
	            sourceLabel = 'Products';
	          } else if (rule.source_type === 'payment_settings') {
	            sourceLink = '/dashboard/settings?tab=payments';
	            sourceLabel = 'Payments';
	          } else if (rule.source_type === 'delivery_settings') {
	            sourceLink = '/dashboard/settings?tab=general';
	            sourceLabel = 'Delivery';
	          }

	          return (
	            <div className="flex items-center gap-2">
	              <Button
	                variant="ghost"
	                size="icon"
	                onClick={() => onView(rule)}
	                className="h-8 w-8 text-muted-foreground hover:text-foreground"
	                title="View Rule"
	              >
	                <Eye size={14} />
	              </Button>
	              <Button
                variant="ghost"
                size="icon"
                disabled
                className="h-8 w-8 text-muted-foreground/30 cursor-not-allowed"
                title="System-managed â€” edit source directly"
              >
                {rule.is_active ? <PowerOff size={14} /> : <Power size={14} />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled
                className="h-8 w-8 text-muted-foreground/30 cursor-not-allowed"
                title="System-managed â€” edit source directly"
              >
                <Edit2 size={14} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled
                className="h-8 w-8 text-red-400/20 cursor-not-allowed"
                title="System-managed â€” edit source directly"
              >
                <Trash2 size={14} />
              </Button>
	              <Link
	                href={sourceLink}
	                className="inline-flex h-7 items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
	              >
	                <ExternalLink size={12} className="text-zinc-500" />
	                {sourceLabel}
	              </Link>
            </div>
          );
        }

	        return (
	          <div className="flex items-center gap-2">
	            <Button variant="ghost" size="icon" onClick={() => onView(rule)} className="h-8 w-8 text-muted-foreground hover:text-foreground" title="View Rule">
	              <Eye size={14} />
	            </Button>
	            <Button variant="ghost" size="icon" onClick={() => onToggleStatus(rule)} className="h-8 w-8 text-muted-foreground hover:text-foreground" title={rule.is_active ? 'Pause Rule' : 'Activate Rule'}>
              {rule.is_active ? <PowerOff size={14} /> : <Power size={14} />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onEdit(rule)} className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Edit Rule">
              <Edit2 size={14} />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(rule.ID)} className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-400/10" title="Delete Rule">
              <Trash2 size={14} />
            </Button>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search rules..."
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-8 bg-muted border-border focus-visible:ring-1 focus-visible:ring-zinc-700 h-9"
            />
          </div>
          {onOpenSimulator && (
            <Button
              variant="outline"
              onClick={onOpenSimulator}
              className="border-border bg-muted hover:bg-secondary text-muted-foreground w-full sm:w-auto h-9"
            >
              <Bot className="w-4 h-4 mr-2 text-amber-500" />
              Test Bot
            </Button>
          )}
        </div>
      </div>

	      <div className="rounded-xl border border-border bg-background overflow-x-auto">
	        <Table className="min-w-[1180px]">
          <TableHeader className="bg-card">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-border hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="text-muted-foreground font-medium h-10">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="border-border hover:bg-card transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                  No rules found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Showing {table.getRowModel().rows.length} rules
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="border-border bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground h-8"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="border-border bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground h-8"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
