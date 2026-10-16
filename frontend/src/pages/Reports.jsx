import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckCheck, Clock3, Users, Wallet } from 'lucide-react';
import api from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { errorMessage, money } from '../utils/constants.js';
import { Button, Loading, Metric, PageHeader, StatusBadge } from '../components/UI.jsx';

const stages = [
  'PENDING',
  'CONFIRMED',
  'ASSIGNED',
  'CUTTING',
  'STITCHING',
  'QUALITY_CHECK',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
];
const monthLabel = (value) =>
  new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit' }).format(
    new Date(`${value}-01T00:00:00`),
  );

export default function Reports() {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [tailors, setTailors] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [busy, setBusy] = useState(true);
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset } = useForm({ defaultValues: {} });

  async function load(filters = {}) {
    setLoading(true);
    try {
      const activeFilters = Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value !== '' && value != null),
      );
      setData((await api.get('/dashboard/reports', { params: activeFilters })).data.data);
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }
  useEffect(() => {
    Promise.all([api.get('/tailors'), api.get('/customers', { params: { limit: 100 } })])
      .then(([tailorResponse, customerResponse]) => {
        setTailors(tailorResponse.data.data || []);
        setCustomers(customerResponse.data.data || []);
      })
      .catch((error) => toast(errorMessage(error), 'error'))
      .finally(() => load());
  }, []);

  const stageCounts = new Map((data?.stages || []).map((row) => [row._id, row.count]));
  return (
    <>
      <PageHeader
        eyebrow="SEE WHAT’S TAKING SHAPE"
        title="Reports"
        subtitle="Filter order and payment performance across your shop."
      />
      <form className="card filterbar" onSubmit={handleSubmit(load)}>
        <label className="field">
          From
          <input type="date" {...register('from')} />
        </label>
        <label className="field">
          To
          <input type="date" {...register('to')} />
        </label>
        <label className="field">
          Order status
          <select {...register('status')}>
            <option value="">All statuses</option>
            {stages.map((status) => (
              <option key={status} value={status}>
                {status.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Payment status
          <select {...register('paymentStatus')}>
            <option value="">All payment statuses</option>
            {['UNPAID', 'PARTIAL', 'PAID', 'REFUNDED'].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label className="field">
          Tailor
          <select {...register('tailor')}>
            <option value="">All tailors</option>
            {tailors.map((tailor) => (
              <option key={tailor._id} value={tailor._id}>
                {tailor.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Customer
          <select {...register('customer')}>
            <option value="">All customers</option>
            {customers.map((customer) => (
              <option key={customer._id} value={customer._id}>
                {customer.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" loading={loading} loadingText="Updating reports…">
          Apply filters
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            reset({});
            load();
          }}
        >
          Clear
        </Button>
      </form>
      {busy ? (
        <Loading />
      ) : (
        <>
          <div className="metric-grid">
            <Metric
              icon={Wallet}
              label="Net revenue"
              value={money(data?.revenue)}
              note="Payments less refunds"
            />
            <Metric
              icon={CheckCheck}
              label="Matching orders"
              value={data?.orders || 0}
              note="For selected filters"
            />
            <Metric
              icon={Users}
              label="Customers"
              value={data?.customers || 0}
              note="With matching orders"
            />
            <Metric
              icon={Clock3}
              label="Open balances"
              value={money((data?.stages || []).reduce((sum, row) => sum + row.remainingAmount, 0))}
              note="Remaining for matching orders"
            />
          </div>
          <div className="report-grid">
            <section className="card analytics-card">
              <div className="panel-title">
                <div>
                  <h2>Monthly collections</h2>
                  <p>Net payments and refunds for matching orders</p>
                </div>
              </div>
              {data?.monthly?.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.monthly}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eceee7" />
                    <XAxis
                      dataKey="_id"
                      tickFormatter={monthLabel}
                      tick={{ fontSize: 10, fill: '#93968a' }}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#93968a' }}
                      tickFormatter={(value) => `₹${Math.round(value / 1000)}k`}
                      axisLine={false}
                    />
                    <Tooltip labelFormatter={monthLabel} formatter={(value) => money(value)} />
                    <Bar
                      dataKey="revenue"
                      name="Net collections"
                      fill="#779074"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state">No payment activity for these filters.</div>
              )}
            </section>
            <section className="card analytics-card">
              <div className="panel-title">
                <div>
                  <h2>Orders by lifecycle stage</h2>
                  <p>Counts from the selected order filters</p>
                </div>
              </div>
              <div className="stage-report">
                {stages.map((status) => (
                  <div key={status}>
                    <span>{status.replaceAll('_', ' ')}</span>
                    <i>
                      <b
                        style={{
                          width: `${data?.orders ? `${Math.max(4, ((stageCounts.get(status) || 0) / data.orders) * 100)}%` : '0%'}`,
                        }}
                      />
                    </i>
                    <small>{stageCounts.get(status) || 0}</small>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <section className="card">
            <div className="panel-title">
              <div>
                <h2>Order stage summary</h2>
                <p>Only stages with matching records are listed.</p>
              </div>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>STATUS</th>
                    <th>ORDERS</th>
                    <th>FINAL AMOUNT</th>
                    <th>REMAINING</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.stages || []).map((row) => (
                    <tr key={row._id}>
                      <td>
                        <StatusBadge value={row._id} />
                      </td>
                      <td>{row.count}</td>
                      <td>{money(row.finalAmount)}</td>
                      <td>{money(row.remainingAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data?.stages?.length && (
                <div className="empty-state">No orders matched these filters.</div>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
