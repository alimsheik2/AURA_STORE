import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatPriceSimple, formatDate } from '@/lib/utils';
import { TrendingUp, DollarSign, RefreshCw, ShoppingBag, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface RevenueStats {
  grossRevenue: number;
  totalRefunds: number;
  netRevenue: number;
  platformCommission: number;
  totalOrders: number;
}

interface OrderRevenue {
  id: string;
  total: number;
  subtotal: number;
  shipping_total: number;
  refund_amount: number;
  payment_status: string;
  refund_status: string;
  created_at: string;
}

export default function AdminRevenue() {
  const [stats, setStats] = useState<RevenueStats>({
    grossRevenue: 0,
    totalRefunds: 0,
    netRevenue: 0,
    platformCommission: 0,
    totalOrders: 0,
  });
  const [recentOrders, setRecentOrders] = useState<OrderRevenue[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRevenueData = async () => {
    setLoading(true);
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, total, subtotal, shipping_total, refund_amount, payment_status, refund_status, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      let gross = 0;
      let refunds = 0;
      const totalCount = orders?.length ?? 0;

      orders?.forEach((o) => {
        if (o.payment_status === 'paid' || o.payment_status === 'refunded' || o.payment_status === 'partially_refunded') {
          gross += Number(o.total || 0);
        }
        refunds += Number(o.refund_amount || 0);
      });

      // Platform commission estimate (10% standard or calculated)
      const commission = gross * 0.10;
      const net = gross - refunds - commission;

      setStats({
        grossRevenue: gross,
        totalRefunds: refunds,
        netRevenue: net > 0 ? net : 0,
        platformCommission: commission,
        totalOrders: totalCount,
      });

      setRecentOrders((orders || []).slice(0, 10));
    } catch (err) {
      console.error('Error fetching revenue stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRevenueData();
  }, []);

  return (
    <div className="bg-white min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Revenue & Financial Analytics</h1>
            <p className="text-sm text-slate-500">Track marketplace gross earnings, refunds, commission and net payout.</p>
          </div>
          <button
            onClick={fetchRevenueData}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gross Revenue</span>
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                <DollarSign size={20} />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">{formatPriceSimple(stats.grossRevenue)}</div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <ArrowUpRight size={14} className="text-emerald-500" /> Total paid orders value
            </p>
          </div>

          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Platform Commission (10%)</span>
              <div className="p-2 bg-sky-100 text-sky-600 rounded-lg">
                <TrendingUp size={20} />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">{formatPriceSimple(stats.platformCommission)}</div>
            <p className="text-xs text-slate-500 mt-1">Platform earned fees</p>
          </div>

          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Refunds</span>
              <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                <ArrowDownRight size={20} />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">{formatPriceSimple(stats.totalRefunds)}</div>
            <p className="text-xs text-slate-500 mt-1 text-rose-500">Processed order refunds</p>
          </div>

          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Vendor Payout</span>
              <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                <ShoppingBag size={20} />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">{formatPriceSimple(stats.netRevenue)}</div>
            <p className="text-xs text-slate-500 mt-1">Gross minus commission & refunds</p>
          </div>
        </div>

        {/* Recent Transactions Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-base font-bold text-slate-900">Recent Financial Transactions</h2>
            <span className="text-xs text-slate-500">Total orders: {stats.totalOrders}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 text-xs font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Order ID</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Total Amount</th>
                  <th className="px-6 py-3">Commission (10%)</th>
                  <th className="px-6 py-3">Payment Status</th>
                  <th className="px-6 py-3">Refund Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                      No order transactions found.
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-900">{o.id.slice(0, 8)}...</td>
                      <td className="px-6 py-4 text-slate-500">{formatDate(o.created_at)}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">{formatPriceSimple(o.total)}</td>
                      <td className="px-6 py-4 text-sky-600 font-medium">{formatPriceSimple(o.total * 0.10)}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                            o.payment_status === 'paid'
                              ? 'bg-emerald-100 text-emerald-700'
                              : o.payment_status === 'refunded'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {o.payment_status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{o.refund_amount ? formatPriceSimple(o.refund_amount) : '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
