import { useI18n } from '@/contexts/I18nContext';
import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Shield,
  ShoppingBag,
  Layers,
  Check,
  X,
  DollarSign,
  Package,
  Users,
  FileCheck,
  Settings,
  Eye,
  Bell,
  Store,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Order, Category, Shop } from '@/lib/types';
import { formatPriceSimple, formatDate, classNames, slugify } from '@/lib/utils';
import AdminRevenue from '@/pages/AdminRevenue';
import AdminCommission from '@/pages/AdminCommission';
import AdminShipping from '@/pages/AdminShipping';

type Tab = 'overview' | 'vendors' | 'orders' | 'categories' | 'settings' | 'finance' | 'revenue' | 'commission' | 'shipping' | 'audit';

interface PlatformSettings {
  default_commission_rate: number;
  default_currency: string;
  support_cod: boolean;
  support_stripe: boolean;
  support_paypal: boolean;
}

interface WithdrawalRequest {
  id: string;
  vendor_id: string;
  amount: number;
  currency: string;
  status: string;
}

interface RefundRequest {
  id: string;
  order_id: string;
  amount: number;
  status: string;
}

interface Dispute {
  id: string;
  order_id: string;
  reason: string;
  status: string;
}

interface AuditLog {
  id: string;
  created_at: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
}

export default function AdminPanel() {
  const { t } = useI18n();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    if (!user) navigate('/signin');
  }, [user, navigate]);

  if (!user) return null;

  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center max-w-md shadow-sm">
          <Shield className="mx-auto text-slate-400 mb-4" size={48} />
          <h1 className="text-xl font-bold text-slate-900">{t('admin.accessRequired')}</h1>
          <p className="text-slate-500 mt-2 mb-5 text-sm">{t('admin.accessText')}</p>
          <Link
            to="/"
            className="inline-block px-5 py-2.5 rounded-lg bg-sky-500 text-white font-medium hover:bg-sky-600 transition-colors"
          >
            {t('admin.backHome')}
          </Link>
        </div>
      </div>
    );
  }

  const tabs = [
    ['overview', t('admin.overview'), Shield],
    ['vendors', t('admin.vendorKyc'), FileCheck],
    ['orders', t('admin.orders'), ShoppingBag],
    ['revenue', 'Revenue & Analytics', DollarSign],
    ['commission', 'Commission Rates', Layers],
    ['shipping', 'Shipping Methods', Package],
    ['categories', t('admin.categoriesCommission'), Store],
    ['finance', t('admin.finance'), DollarSign],
    ['audit', t('admin.audit'), Bell],
    ['settings', t('admin.platformSettings'), Settings],
  ] as const;

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-slate-900 rounded-2xl p-6 mb-6 text-white shadow-sm">
          <div className="flex items-center gap-3">
            <Shield className="text-sky-400" size={28} />
            <div>
              <h1 className="text-xl font-bold">{t('admin.controlPanel')}</h1>
              <p className="text-sm text-slate-300">{t('admin.controlSubtitle')}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-1 mb-6 overflow-x-auto border-b border-gray-200">
          {tabs.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id as Tab)}
              className={classNames(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
                tab === id ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </div>

        {tab === 'overview' && <Overview />}
        {tab === 'vendors' && <Vendors />}
        {tab === 'orders' && <Orders />}
        {tab === 'revenue' && <AdminRevenue />}
        {tab === 'commission' && <AdminCommission />}
        {tab === 'shipping' && <AdminShipping />}
        {tab === 'categories' && <Categories />}
        {tab === 'settings' && <SettingsTab />}
        {tab === 'finance' && <FinanceTab />}
        {tab === 'audit' && <AuditTab />}
      </div>
    </div>
  );
}

function Overview() {
  const { t } = useI18n();
  const [s, setS] = useState({ vendors: 0, pending: 0, orders: 0, revenue: 0, products: 0, customers: 0 });

  useEffect(() => {
    (async () => {
      const [v, p, o, pr, c] = await Promise.all([
        supabase.from('shops').select('id', { count: 'exact', head: true }),
        supabase.from('shops').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('orders').select('total'),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
      ]);
      const orders = (o.data as Order[]) ?? [];
      setS({
        vendors: v.count ?? 0,
        pending: p.count ?? 0,
        orders: orders.length,
        revenue: orders.reduce((a, x) => a + Number(x.total || 0), 0),
        products: pr.count ?? 0,
        customers: c.count ?? 0,
      });
    })();
  }, []);

  const cards = [
    [t('admin.vendors'), s.vendors, Store],
    [t('admin.pending'), s.pending, FileCheck],
    [t('admin.orders'), s.orders, ShoppingBag],
    [t('admin.revenue'), formatPriceSimple(s.revenue), DollarSign],
    [t('admin.products'), s.products, Package],
    [t('admin.customers'), s.customers, Users],
  ] as const;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
      {cards.map(([l, v, Icon]) => (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm" key={String(l)}>
          <Icon size={19} className="text-sky-500 mb-3" />
          <p className="text-xs text-slate-500">{l}</p>
          <p className="text-2xl font-bold text-slate-900">{v}</p>
        </div>
      ))}
    </div>
  );
}

function Vendors() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const { data } = await supabase.from('shops').select('*').order('created_at', { ascending: false });
    setRows((data as Shop[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (id: string, status: 'approved' | 'rejected' | 'pending') => {
    const r = await supabase.functions.invoke('admin-vendor-review', {
      body: { vendor_id: id, status, commission_rate: Number(rates[id] ?? 10) },
    });
    if (r.error || r.data?.ok === false) {
      alert(r.error?.message || r.data?.error || 'Review failed');
    } else {
      load();
    }
  };

  const doc = async (id: string) => {
    const r = await supabase.functions.invoke('admin-vendor-review', {
      body: { action: 'document_url', vendor_id: id },
    });
    if (r.data?.url) {
      window.open(r.data.url, '_blank', 'noopener,noreferrer');
    } else {
      alert(r.data?.error || r.error?.message || 'Document unavailable');
    }
  };

  if (loading) return <div className="py-16 text-center text-slate-400">{t('common.loading')}</div>;

  return (
    <div className="space-y-3">
      {rows.map((s) => (
        <div
          key={s.id}
          className="bg-white rounded-xl border border-gray-200 p-5 flex flex-wrap items-center gap-4 justify-between shadow-sm"
        >
          <div>
            <p className="font-bold text-slate-900">{s.name}</p>
            <p className="text-xs text-slate-500">
              {formatDate(s.created_at)} · <span className="font-medium text-slate-700">{s.status}</span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <label className="text-xs text-slate-500">
              {t('admin.commission')}{' '}
              <input
                value={rates[s.owner_id] ?? '10'}
                onChange={(e) => setRates({ ...rates, [s.owner_id]: e.target.value })}
                type="number"
                min="0"
                max="100"
                step="0.01"
                className="w-20 border border-gray-300 rounded-lg px-2 py-1 ms-1 text-slate-900"
              />
              %
            </label>
            <button
              onClick={() => doc(s.owner_id)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50"
            >
              <Eye size={15} className="inline me-1" />
              {t('admin.kyc')}
            </button>
            {s.status === 'pending' && (
              <button
                onClick={() => review(s.owner_id, 'approved')}
                className="px-3 py-2 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600 font-medium"
              >
                <Check size={15} className="inline me-1" />
                {t('admin.approve')}
              </button>
            )}
            {s.status !== 'rejected' && (
              <button
                onClick={() => review(s.owner_id, 'rejected')}
                className="px-3 py-2 bg-rose-500 text-white rounded-lg text-sm hover:bg-rose-600 font-medium"
              >
                <X size={15} className="inline me-1" />
                {t('admin.reject')}
              </button>
            )}
            {s.status === 'suspended' && (
              <button
                onClick={() => review(s.owner_id, 'approved')}
                className="px-3 py-2 bg-sky-500 text-white rounded-lg text-sm hover:bg-sky-600 font-medium"
              >
                {t('admin.reinstate')}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Orders() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Order[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    setRows((data as Order[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (id: string, status: string) => {
    const { error } = await supabase.from('orders').update({ status }).eq('id', id);
    if (error) alert(error.message);
    else load();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-gray-200">
          <tr>
            {[t('common.order'), t('common.customer'), t('common.date'), t('common.total'), t('common.status')].map(
              (x) => (
                <th className="text-start text-xs font-semibold text-slate-600 px-4 py-3" key={x}>
                  {x}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id} className="border-t border-gray-100 hover:bg-slate-50/50">
              <td className="px-4 py-3 font-mono text-sm text-slate-800">#{o.id.slice(0, 8)}</td>
              <td className="px-4 py-3 text-sm text-slate-800">{o.customer_name}</td>
              <td className="px-4 py-3 text-sm text-slate-500">{formatDate(o.created_at)}</td>
              <td className="px-4 py-3 font-bold text-slate-900">{formatPriceSimple(o.total)}</td>
              <td className="px-4 py-3">
                <select
                  value={o.status}
                  onChange={(e) => update(o.id, e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-sm bg-white text-slate-800"
                >
                  <option value="pending">{t('common.pending')}</option>
                  <option value="confirmed">{t('orders.confirmed')}</option>
                  <option value="shipped">{t('orders.shipped')}</option>
                  <option value="delivered">{t('orders.delivered')}</option>
                  <option value="cancelled">{t('common.rejected')}</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="p-10 text-center text-slate-500">{t('admin.noOrders')}</p>}
    </div>
  );
}

function Categories() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [rate, setRate] = useState('10');

  const load = useCallback(async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    setRows((data as Category[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from('categories').insert({
      name: name.trim(),
      slug: slugify(name) + '-' + Date.now().toString(36),
      icon: 'Package',
      commission_rate: Math.min(100, Math.max(0, Number(rate) || 10)),
    });
    if (error) {
      alert(error.message);
    } else {
      setName('');
      setRate('10');
      load();
    }
  };

  return (
    <div>
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-2 shadow-sm">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('admin.categoryName')}
          className="h-10 border border-gray-300 rounded-lg px-3 text-slate-900"
        />
        <input
          type="number"
          min="0"
          max="100"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          className="h-10 w-24 border border-gray-300 rounded-lg px-3 text-slate-900"
        />
        <button
          onClick={add}
          className="h-10 px-4 rounded-lg bg-sky-500 text-white font-medium hover:bg-sky-600 transition-colors"
        >
          {t('admin.add')}
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-gray-200">
            <tr>
              <th className="text-start px-4 py-3 text-xs font-semibold text-slate-600">{t('vendor.category')}</th>
              <th className="text-start px-4 py-3 text-xs font-semibold text-slate-600">{t('admin.commissionPercent')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr className="border-t border-gray-100" key={c.id}>
                <td className="px-4 py-3 text-slate-800">{c.name}</td>
                <td className="px-4 py-3">
                  <input
                    defaultValue={c.commission_rate}
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    onBlur={async (e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n)) {
                        await supabase.from('categories').update({ commission_rate: n }).eq('id', c.id);
                        load();
                      }
                    }}
                    className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-slate-900"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsTab() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<PlatformSettings>({
    default_commission_rate: 10,
    default_currency: 'USD',
    support_cod: true,
    support_stripe: false,
    support_paypal: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'marketplace')
      .maybeSingle()
      .then(({ data }) => {
        const settingData = data as { value?: Partial<PlatformSettings> } | null;
        if (settingData?.value) {
          setSettings((x) => ({ ...x, ...settingData.value }));
        }
      });
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('platform_settings').upsert({
      key: 'marketplace',
      value: settings,
      is_public: true,
    });
    setSaving(false);
    if (error) alert(error.message);
    else alert(t('admin.settingsSaved'));
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl shadow-sm">
      <h2 className="font-bold text-lg text-slate-900 mb-5">{t('admin.platformSettings')}</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="text-sm text-slate-700">
          {t('admin.defaultCommission')}
          <input
            className="mt-1 w-full border border-gray-300 rounded-lg h-10 px-3 text-slate-900"
            type="number"
            min="0"
            max="100"
            value={settings.default_commission_rate}
            onChange={(e) => setSettings({ ...settings, default_commission_rate: Number(e.target.value) })}
          />
        </label>
        <label className="text-sm text-slate-700">
          {t('admin.defaultCurrency')}
          <input
            className="mt-1 w-full border border-gray-300 rounded-lg h-10 px-3 text-slate-900"
            value={settings.default_currency}
            onChange={(e) => setSettings({ ...settings, default_currency: e.target.value.toUpperCase() })}
          />
        </label>
      </div>
      <div className="space-y-3 mt-5">
        {(['support_cod', 'support_stripe', 'support_paypal'] as const).map((k) => (
          <label key={k} className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={!!settings[k]}
              onChange={(e) => setSettings({ ...settings, [k]: e.target.checked })}
              className="rounded text-sky-500 focus:ring-sky-400"
            />
            {k.replace('support_', '').toUpperCase()} {t('admin.enabled')}
          </label>
        ))}
      </div>
      <p className="text-xs text-slate-500 mt-5">{t('admin.secretNote')}</p>
      <button
        onClick={save}
        disabled={saving}
        className="mt-6 px-5 h-10 rounded-lg bg-sky-500 text-white font-medium hover:bg-sky-600 transition-colors disabled:opacity-50"
      >
        {saving ? t('admin.saving') : t('admin.saveSettings')}
      </button>
    </div>
  );
}

function FinanceTab() {
  const { t } = useI18n();
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);

  const load = useCallback(async () => {
    const [w, r, d] = await Promise.all([
      supabase.from('withdrawal_requests').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('refund_requests').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('disputes').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    setWithdrawals((w.data as WithdrawalRequest[]) ?? []);
    setRefunds((r.data as RefundRequest[]) ?? []);
    setDisputes((d.data as Dispute[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (table: string, id: string, status: string) => {
    const { error } = await supabase
      .from(table)
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) alert(error.message);
    else load();
  };

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="font-bold text-slate-900 mb-4">{t('admin.withdrawalRequests')}</h2>
        {withdrawals.length === 0 ? (
          <p className="text-sm text-slate-500">{t('admin.noWithdrawals')}</p>
        ) : (
          <div className="space-y-2">
            {withdrawals.map((x) => (
              <div key={x.id} className="flex flex-wrap justify-between gap-3 border-b border-gray-100 py-3">
                <span className="text-slate-800">
                  {x.vendor_id.slice(0, 8)} · {x.amount} {x.currency}
                </span>
                <span className="flex gap-2">
                  <b className="text-xs self-center uppercase text-slate-600">{x.status}</b>
                  {x.status === 'pending' && (
                    <>
                      <button
                        onClick={() => update('withdrawal_requests', x.id, 'approved')}
                        className="px-2.5 py-1 text-xs bg-sky-500 text-white rounded hover:bg-sky-600 font-medium"
                      >
                        {t('admin.approve')}
                      </button>
                      <button
                        onClick={() => update('withdrawal_requests', x.id, 'rejected')}
                        className="px-2.5 py-1 text-xs bg-rose-500 text-white rounded hover:bg-rose-600 font-medium"
                      >
                        {t('admin.reject')}
                      </button>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="font-bold text-slate-900 mb-4">{t('admin.refundRequests')}</h2>
        {refunds.length === 0 ? (
          <p className="text-sm text-slate-500">{t('admin.noRefunds')}</p>
        ) : (
          refunds.map((x) => (
            <div key={x.id} className="flex flex-wrap justify-between gap-3 border-b border-gray-100 py-3">
              <span className="text-slate-800">
                {x.order_id.slice(0, 8)} · {x.amount}
              </span>
              <span className="flex gap-2">
                <b className="text-xs self-center uppercase text-slate-600">{x.status}</b>
                {x.status === 'pending' && (
                  <>
                    <button
                      onClick={() => update('refund_requests', x.id, 'approved')}
                      className="px-2.5 py-1 text-xs bg-sky-500 text-white rounded hover:bg-sky-600 font-medium"
                    >
                      {t('admin.approve')}
                    </button>
                    <button
                      onClick={() => update('refund_requests', x.id, 'rejected')}
                      className="px-2.5 py-1 text-xs bg-rose-500 text-white rounded hover:bg-rose-600 font-medium"
                    >
                      {t('admin.reject')}
                    </button>
                  </>
                )}
              </span>
            </div>
          ))
        )}
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="font-bold text-slate-900 mb-4">{t('admin.disputes')}</h2>
        {disputes.length === 0 ? (
          <p className="text-sm text-slate-500">{t('admin.noDisputes')}</p>
        ) : (
          disputes.map((x) => (
            <div key={x.id} className="flex justify-between border-b border-gray-100 py-3">
              <span className="text-slate-800">
                {x.order_id.slice(0, 8)} · {x.reason}
              </span>
              <b className="text-xs uppercase text-slate-600">{x.status}</b>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function AuditTab() {
  const { t } = useI18n();
  const [rows, setRows] = useState<AuditLog[]>([]);

  useEffect(() => {
    supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => setRows((data as AuditLog[]) ?? []));
  }, []);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-gray-200">
          <tr>
            <th className="text-start p-3 font-semibold text-slate-600">{t('admin.time')}</th>
            <th className="text-start p-3 font-semibold text-slate-600">{t('admin.action')}</th>
            <th className="text-start p-3 font-semibold text-slate-600">{t('admin.entity')}</th>
            <th className="text-start p-3 font-semibold text-slate-600">{t('admin.metadata')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.id} className="border-t border-gray-100 hover:bg-slate-50/50">
              <td className="p-3 text-slate-500">{formatDate(x.created_at)}</td>
              <td className="p-3 font-medium text-slate-900">{x.action}</td>
              <td className="p-3 text-slate-800">
                {x.entity_type} {x.entity_id?.slice?.(0, 8)}
              </td>
              <td className="p-3 text-xs text-slate-500 max-w-md truncate">{JSON.stringify(x.metadata)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
