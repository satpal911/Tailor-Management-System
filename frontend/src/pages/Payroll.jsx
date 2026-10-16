import { Fragment, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Plus, Wallet } from 'lucide-react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { date, errorMessage, money, ROLES } from '../utils/constants.js';
import { Button, Loading, Metric, Modal, PageHeader, StatusBadge } from '../components/UI.jsx';

const blank = {
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  baseSalary: '',
  bonuses: 0,
  overtime: 0,
  deductions: 0,
  advance: 0,
  notes: '',
};

export default function Payroll() {
  const { user, refresh } = useAuth();
  const { toast } = useToast();
  const admin = user.role === ROLES.ADMIN;
  const [rows, setRows] = useState([]);
  const [staff, setStaff] = useState([]);
  const [busy, setBusy] = useState(true);
  const [modal, setModal] = useState('');
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const form = useForm({ defaultValues: blank });
  const paymentForm = useForm();
  const baseSalaryForm = useForm();

  async function load() {
    try {
      const [salaryResponse, staffResponse] = await Promise.all([
        api.get(admin ? '/salaries' : '/salaries/mine'),
        admin
          ? api.get('/tailors', { params: { limit: 100 } })
          : Promise.resolve({ data: { data: [] } }),
      ]);
      setRows(salaryResponse.data.data || []);
      setStaff(
        (staffResponse.data.data || [])
          .filter((row) => row.status === 'ACTIVE' && row.user?.accountStatus === 'ACTIVE')
          .map((row) => row.user),
      );
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, [admin]);

  function openCreate() {
    setSelected(null);
    form.reset(blank);
    setModal('salary');
  }
  function openBaseSalary() {
    baseSalaryForm.reset({ employee: '', baseSalary: admin ? '' : (user.defaultBaseSalary ?? '') });
    setModal('base-salary');
  }
  function openEdit(row) {
    setSelected(row);
    form.reset({
      month: row.month,
      year: row.year,
      baseSalary: row.baseSalary,
      bonuses: row.bonuses,
      overtime: row.overtime,
      deductions: row.deductions,
      advance: row.advance,
      notes: row.notes,
    });
    setModal('salary');
  }
  async function save(values) {
    if (saving) return;
    setSaving(true);
    const payload = {
      ...values,
      month: Number(values.month),
      year: Number(values.year),
      baseSalary:
        values.baseSalary === '' || values.baseSalary === undefined
          ? undefined
          : Number(values.baseSalary),
      bonuses: Number(values.bonuses || 0),
      overtime: Number(values.overtime || 0),
      deductions: Number(values.deductions || 0),
      advance: Number(values.advance || 0),
    };
    try {
      if (selected) await api.patch(`/salaries/${selected._id}`, payload);
      else await api.post('/salaries', { ...payload, employee: values.employee });
      toast(selected ? 'Salary updated' : 'Salary created');
      setModal('');
      await load();
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  }
  async function saveBaseSalary(values) {
    if (saving) return;
    setSaving(true);
    try {
      await api.patch('/salaries/base-salary', {
        baseSalary: Number(values.baseSalary),
        ...(admin ? { employee: values.employee } : {}),
      });
      toast('Base salary saved');
      setModal('');
      await refresh();
      await load();
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  }
  function openPayment(row) {
    setSelected(row);
    paymentForm.reset({
      amount: Number((row.netSalary - row.amountPaid).toFixed(2)),
      method: 'BANK_TRANSFER',
      reference: '',
    });
    setModal('payment');
  }
  async function pay(values) {
    if (saving) return;
    setSaving(true);
    try {
      await api.post(`/salaries/${selected._id}/payments`, {
        ...values,
        amount: Number(values.amount),
      });
      toast('Salary payment recorded');
      setModal('');
      await load();
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  }

  const totalPaid = rows.reduce((sum, row) => sum + row.amountPaid, 0);
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const currentSalary = rows.find((row) => row.month === currentMonth && row.year === currentYear);
  const pending = rows
    .filter((row) => row.paymentStatus !== 'PAID')
    .reduce((sum, row) => sum + row.netSalary - row.amountPaid, 0);
  return (
    <>
      <PageHeader
        eyebrow={admin ? 'SHOP PAYROLL' : 'YOUR PAY HISTORY'}
        title={admin ? 'Salaries & payroll' : 'My salary'}
        subtitle={
          admin
            ? 'Prepare monthly payroll and keep payment history.'
            : 'Your salary records and payment status.'
        }
      >
        {admin && (
          <>
            <Button variant="outline" onClick={openBaseSalary}>
              Change base salary
            </Button>
            <Button onClick={openCreate} icon={Plus}>
              Add salary
            </Button>
          </>
        )}
      </PageHeader>
      <div className="metric-grid">
        <Metric
          icon={Wallet}
          label={admin ? 'Salary paid' : 'Current month net salary'}
          value={money(admin ? totalPaid : currentSalary?.netSalary || 0)}
          note={
            admin
              ? `${rows.length} salary records`
              : currentSalary
                ? `${new Date(currentYear, currentMonth - 1).toLocaleDateString(undefined, { month: 'long' })} · ${currentSalary.paymentStatus.toLowerCase().replaceAll('_', ' ')}`
                : 'No salary record for this month yet'
          }
        />
        <Metric
          icon={Wallet}
          label={admin ? 'Outstanding payroll' : 'Remaining to be paid'}
          value={money(pending)}
          note="Across visible records"
        />
        <Metric
          icon={Wallet}
          label="Paid records"
          value={rows.filter((row) => row.paymentStatus === 'PAID').length}
          note="Fully settled"
        />
      </div>
      {busy ? (
        <Loading />
      ) : (
        <section className="card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PERIOD</th>
                  {admin && <th>EMPLOYEE</th>}
                  <th>NET SALARY</th>
                  <th>PAID</th>
                  <th>REMAINING</th>
                  <th>STATUS</th>
                  {admin && <th>ACTIONS</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Fragment key={row._id}>
                    <tr>
                      <td>
                        {new Date(row.year, row.month - 1).toLocaleDateString(undefined, {
                          month: 'long',
                          year: 'numeric',
                        })}
                      </td>
                      {admin && (
                        <td>
                          {row.employee?.name || '—'}
                          <small>{row.employee?.phone}</small>
                        </td>
                      )}
                      <td>{money(row.netSalary)}</td>
                      <td>{money(row.amountPaid)}</td>
                      <td>{money(row.netSalary - row.amountPaid)}</td>
                      <td>
                        <StatusBadge value={row.paymentStatus} />
                      </td>
                      {admin && (
                        <td>
                          <div className="actions">
                            <Button
                              variant="outline"
                              onClick={() => openEdit(row)}
                              disabled={row.amountPaid > 0}
                            >
                              Edit
                            </Button>
                            {row.paymentStatus !== 'PAID' && (
                              <Button onClick={() => openPayment(row)}>Record payment</Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                    <tr>
                      <td colSpan={admin ? 7 : 5}>
                        <details className="salary-details">
                          <summary>View salary breakdown and payments</summary>
                          <div className="mt-3 grid gap-4 sm:grid-cols-2">
                            <div>
                              <h3 className="font-semibold">Salary breakdown</h3>
                              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                <dt>Base salary</dt>
                                <dd>{money(row.baseSalary)}</dd>
                                <dt>Bonuses</dt>
                                <dd>{money(row.bonuses)}</dd>
                                <dt>Overtime</dt>
                                <dd>{money(row.overtime)}</dd>
                                <dt>Deductions</dt>
                                <dd>−{money(row.deductions)}</dd>
                                <dt>Advance</dt>
                                <dd>−{money(row.advance)}</dd>
                                <dt className="font-semibold">Net salary</dt>
                                <dd className="font-semibold">{money(row.netSalary)}</dd>
                              </dl>
                              {row.notes && <p className="mt-3 text-sm">{row.notes}</p>}
                            </div>
                            <div>
                              <h3 className="font-semibold">Payments</h3>
                              {row.payments?.length ? (
                                <ul className="mt-2 grid gap-2 text-sm">
                                  {row.payments.map((payment) => (
                                    <li key={payment._id}>
                                      {money(payment.amount)} ·{' '}
                                      {payment.method?.replaceAll('_', ' ') || 'Payment'} ·{' '}
                                      {date(payment.paidAt)}
                                      {payment.reference && ` · Ref: ${payment.reference}`}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-2 text-sm text-[var(--muted)]">
                                  No payments recorded for this salary period.
                                </p>
                              )}
                            </div>
                          </div>
                        </details>
                      </td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <div className="empty-state">
                <b>No salary records</b>
                <span>
                  {admin
                    ? 'Create a monthly salary record to get started.'
                    : 'Your salary history will appear here.'}
                </span>
              </div>
            )}
          </div>
        </section>
      )}
      {modal === 'salary' && (
        <Modal
          title={selected ? 'Edit salary record' : 'Create salary record'}
          onClose={() => setModal('')}
        >
          <form onSubmit={form.handleSubmit(save)}>
            {!selected && (
              <label className="field">
                Employee
                <select
                  required
                  {...form.register('employee', {
                    required: true,
                    onChange: (event) => {
                      const employee = staff.find((person) => person._id === event.target.value);
                      form.setValue('baseSalary', employee?.defaultBaseSalary ?? '');
                    },
                  })}
                >
                  <option value="">Select an active staff member</option>
                  {staff.map((person) => (
                    <option key={person._id} value={person._id}>
                      {person.name} · {person.phone}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="two-fields">
              <label className="field">
                Month
                <input
                  type="number"
                  min="1"
                  max="12"
                  required
                  {...form.register('month', { required: true, min: 1, max: 12 })}
                />
              </label>
              <label className="field">
                Year
                <input
                  type="number"
                  min="2000"
                  max="2200"
                  required
                  {...form.register('year', { required: true, min: 2000, max: 2200 })}
                />
              </label>
            </div>
            {['baseSalary', 'bonuses', 'overtime', 'deductions', 'advance'].map((key) => (
              <label className="field" key={key}>
                {key.replace(/([A-Z])/g, ' $1')}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required={
                    key === 'baseSalary' &&
                    Boolean(
                      selected ||
                      staff.find((person) => person._id === form.watch('employee'))
                        ?.defaultBaseSalary == null,
                    )
                  }
                  {...form.register(key, { min: 0 })}
                />
                {key === 'baseSalary' &&
                  !selected &&
                  staff.find((person) => person._id === form.watch('employee'))
                    ?.defaultBaseSalary != null && (
                    <small>Uses the saved default; change it to override this period only.</small>
                  )}
              </label>
            ))}
            <label className="field">
              Notes
              <textarea rows="2" maxLength="2000" {...form.register('notes')} />
            </label>
            <Button
              type="submit"
              loading={saving}
              loadingText={selected ? 'Saving changes…' : 'Creating salary…'}
            >
              {selected ? 'Save changes' : 'Create salary'}
            </Button>
          </form>
        </Modal>
      )}
      {modal === 'payment' && selected && (
        <Modal
          title={`Record payment · ${selected.employee?.name || selected.month + '/' + selected.year}`}
          onClose={() => setModal('')}
        >
          <p>
            Remaining balance: <b>{money(selected.netSalary - selected.amountPaid)}</b>
          </p>
          <p className="mb-4 text-sm text-[var(--muted)]">
            Record this after the salary has actually been paid by cash, UPI, or bank transfer. This
            records the payout; it does not transfer money.
          </p>
          <form onSubmit={paymentForm.handleSubmit(pay)}>
            <label className="field">
              Amount
              <input
                type="number"
                min="0.01"
                max={selected.netSalary - selected.amountPaid}
                step="0.01"
                required
                {...paymentForm.register('amount', { required: true, min: 0.01 })}
              />
            </label>
            <label className="field">
              Method
              <select {...paymentForm.register('method')}>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="UPI">UPI</option>
                <option value="CASH">Cash</option>
                <option value="OTHER">Other</option>
              </select>
            </label>
            <label className="field">
              Reference
              <input maxLength="120" {...paymentForm.register('reference')} />
            </label>
            <Button type="submit" loading={saving} loadingText="Saving payment…">
              Save payment
            </Button>
          </form>
        </Modal>
      )}
      {admin && modal === 'base-salary' && (
        <Modal
          title="Change tailor base salary"
          onClose={() => setModal('')}
        >
          <form onSubmit={baseSalaryForm.handleSubmit(saveBaseSalary)}>
            <label className="field">
              Employee
              <select
                required
                {...baseSalaryForm.register('employee', {
                  required: true,
                  onChange: (event) => {
                    const employee = staff.find((person) => person._id === event.target.value);
                    baseSalaryForm.setValue('baseSalary', employee?.defaultBaseSalary ?? '');
                  },
                })}
              >
                <option value="">Select an active tailor</option>
                {staff.map((person) => (
                  <option key={person._id} value={person._id}>
                    {person.name} · {person.phone}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Monthly base salary
              <input
                type="number"
                min="0"
                step="0.01"
                required
                {...baseSalaryForm.register('baseSalary', {
                  required: true,
                  min: 0,
                  valueAsNumber: true,
                })}
              />
            </label>
            <Button type="submit" loading={saving} loadingText="Saving base salary…">
              Save base salary
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
