import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft, ArrowRight, Check, Filter, LoaderCircle, Plus, X } from 'lucide-react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { date, errorMessage, money, ORDER_STATUSES, ROLES } from '../utils/constants.js';
import {
  Button,
  EmptyState,
  Loading,
  PageHeader,
  Pagination,
  SearchBox,
  StatusBadge,
} from '../components/UI.jsx';

const steps = ['Order details', 'Design references', 'Review & submit'];
const acceptedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxImageSize = 5 * 1024 * 1024;

export default function Orders({ create = false, assigned = false }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [services, setServices] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [uploadError, setUploadError] = useState('');
  const [submitBusy, setSubmitBusy] = useState(false);
  const [step, setStep] = useState(0);
  const {
    register,
    handleSubmit,
    reset,
    trigger,
    getValues,
    formState: { errors },
  } = useForm();
  const customerMode = user.role === ROLES.CUSTOMER;

  async function load() {
    setBusy(true);
    try {
      const response = await api.get('/orders', {
        params: { page, limit: 12, status: status || undefined, search: search || undefined },
      });
      setRows(response.data.data);
      setMeta(response.data.meta);
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const timeout = setTimeout(load, 220);
    return () => clearTimeout(timeout);
  }, [page, status, search]);
  useEffect(() => {
    if (!create) return;
    if (!customerMode)
      api
        .get('/customers', { params: { limit: 100 } })
        .then((r) => setCustomers(r.data.data))
        .catch((e) => toast(errorMessage(e), 'error'));
    api
      .get('/services', { params: { limit: 100 } })
      .then((r) => setServices(r.data.data))
      .catch((e) => toast(errorMessage(e), 'error'));
  }, [create, customerMode]);
  useEffect(() => {
    const urls = uploads.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [uploads]);

  async function save(values) {
    if (submitBusy) return;
    setSubmitBusy(true);
    try {
      const form = new FormData();
      for (const key of ['customer', 'dueDate', 'discount', 'tax'])
        if (values[key]) form.append(key, values[key]);
      const item = customerMode
        ? { quantity: Number(values.quantity), service: values.service }
        : {
            description: values.description,
            quantity: Number(values.quantity),
            unitPrice: Number(values.unitPrice),
            ...(values.service ? { service: values.service } : {}),
          };
      form.append('items', JSON.stringify([item]));
      uploads.forEach((file) => form.append('images', file));
      const response = await api.post('/orders', form);
      toast('Order created');
      reset();
      setUploads([]);
      location.assign(`/app/${customerMode ? 'my-orders' : 'orders'}/${response.data.data._id}`);
    } catch (error) {
      toast(errorMessage(error), 'error');
    } finally {
      setSubmitBusy(false);
    }
  }

  function selectImages(event) {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    const invalidType = selected.some((file) => !acceptedImageTypes.has(file.type));
    const oversized = selected.some((file) => file.size > maxImageSize);
    const invalidMessage = invalidType
      ? 'Please upload JPG, PNG, or WEBP images.'
      : oversized
        ? 'Each image must be 5 MB or smaller.'
        : '';
    const valid = selected.filter(
      (file) => acceptedImageTypes.has(file.type) && file.size <= maxImageSize,
    );
    const unique = valid.filter(
      (file) =>
        !uploads.some(
          (existing) =>
            existing.name === file.name &&
            existing.lastModified === file.lastModified &&
            existing.size === file.size,
        ),
    );
    const exceedsLimit = uploads.length + unique.length > 5;
    const message = invalidMessage || (exceedsLimit ? 'You can attach up to 5 images.' : '');
    setUploadError(message);
    if (message) toast(message, 'error');
    setUploads([...uploads, ...unique].slice(0, 5));
  }

  async function nextStep() {
    const fields =
      step === 0
        ? [
            ...(!customerMode ? ['customer', 'description', 'unitPrice'] : []),
            'service',
            'quantity',
            'dueDate',
          ]
        : [];
    if (fields.length && !(await trigger(fields))) return;
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  if (create)
    return (
      <>
        <PageHeader
          eyebrow="A NEW PIECE BEGINS"
          title="Create an order"
          subtitle="Share a few details to get this piece underway."
        >
          <Button
            variant="outline"
            to={`/app/${customerMode ? 'my-orders' : 'orders'}`}
            icon={ArrowLeft}
          >
            Back to orders
          </Button>
        </PageHeader>
        <div className="order-wizard card">
          <ol className="wizard-steps" aria-label="Order creation steps">
            {steps.map((label, index) => (
              <li
                className={index === step ? 'current' : index < step ? 'complete' : ''}
                key={label}
              >
                <span>{index < step ? <Check size={15} /> : index + 1}</span>
                <b>{label}</b>
              </li>
            ))}
          </ol>
          <form className="order-form" onSubmit={handleSubmit(save)}>
            <div className="wizard-form-content">
              {step === 0 && (
                <section>
                  <span className="eyebrow">STEP 01 · THE PIECE</span>
                  <h2>Order details</h2>
                  <p>Tell your atelier what you have in mind.</p>
                  {!customerMode && (
                    <label className="field">
                      Customer
                      <select
                        aria-invalid={Boolean(errors.customer)}
                        {...register('customer', { required: 'Choose a customer' })}
                      >
                        <option value="">Select customer…</option>
                        {customers.map((customer) => (
                          <option value={customer._id} key={customer._id}>
                            {customer.name} · {customer.phone}
                          </option>
                        ))}
                      </select>
                      {errors.customer && (
                        <small className="field-error">{errors.customer.message}</small>
                      )}
                    </label>
                  )}
                  <label className="field">
                    Service
                    <select
                      aria-invalid={Boolean(errors.service)}
                      {...register('service', {
                        required: customerMode ? 'Choose a service' : false,
                      })}
                    >
                      <option value="">
                        {customerMode ? 'Choose a service…' : 'Custom service'}
                      </option>
                      {services.map((service) => (
                        <option key={service._id} value={service._id}>
                          {service.name} · {money(service.basePrice)}
                        </option>
                      ))}
                    </select>
                    {errors.service && (
                      <small className="field-error">{errors.service.message}</small>
                    )}
                  </label>
                  <div className="two-fields">
                    {!customerMode && (
                      <label className="field">
                        Garment / service description
                        <input
                          placeholder="e.g. Silk blouse, boat neckline"
                          aria-invalid={Boolean(errors.description)}
                          {...register('description', { required: 'Add a short description' })}
                        />
                        {errors.description && (
                          <small className="field-error">{errors.description.message}</small>
                        )}
                      </label>
                    )}
                    <label className="field">
                      Quantity
                      <input
                        type="number"
                        min="1"
                        defaultValue="1"
                        aria-invalid={Boolean(errors.quantity)}
                        {...register('quantity', {
                          valueAsNumber: true,
                          min: { value: 1, message: 'Quantity must be at least one' },
                          required: 'Enter a quantity',
                        })}
                      />
                      {errors.quantity && (
                        <small className="field-error">{errors.quantity.message}</small>
                      )}
                    </label>
                  </div>
                  <div className="two-fields">
                    {!customerMode && (
                      <label className="field">
                        Price per piece (₹)
                        <input
                          type="number"
                          min="0"
                          step="1"
                          aria-invalid={Boolean(errors.unitPrice)}
                          {...register('unitPrice', {
                            required: 'Price is required',
                            valueAsNumber: true,
                            min: { value: 0, message: 'Price cannot be negative' },
                          })}
                        />
                        {errors.unitPrice && (
                          <small className="field-error">{errors.unitPrice.message}</small>
                        )}
                      </label>
                    )}
                    <label className="field">
                      Expected completion
                      <input
                        type="date"
                        min={new Date().toISOString().slice(0, 10)}
                        aria-invalid={Boolean(errors.dueDate)}
                        {...register('dueDate', { required: 'Choose a due date' })}
                      />
                      {errors.dueDate && (
                        <small className="field-error">{errors.dueDate.message}</small>
                      )}
                    </label>
                  </div>
                  {!customerMode && (
                    <div className="two-fields">
                      <label className="field">
                        Discount (₹)
                        <input
                          type="number"
                          min="0"
                          defaultValue="0"
                          {...register('discount', { valueAsNumber: true, min: 0 })}
                        />
                      </label>
                      <label className="field">
                        Tax (₹)
                        <input
                          type="number"
                          min="0"
                          defaultValue="0"
                          {...register('tax', { valueAsNumber: true, min: 0 })}
                        />
                      </label>
                    </div>
                  )}
                </section>
              )}
              {step === 1 && (
                <section>
                  <span className="eyebrow">STEP 02 · THE INSPIRATION</span>
                  <h2>Design references</h2>
                  <p>Add photos that help the atelier understand your preferred look and finish.</p>
                  <label className="upload-drop">
                    <input
                      type="file"
                      name="images"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      aria-describedby="design-image-help"
                      onChange={selectImages}
                    />
                    <span className="upload-icon">
                      <Plus size={19} />
                    </span>
                    <b>Choose reference images</b>
                    <small id="design-image-help">
                      JPG, PNG or WEBP · up to 5 MB each · 5 images maximum
                    </small>
                  </label>
                  {uploadError && (
                    <p className="upload-error" role="alert">
                      {uploadError}
                    </p>
                  )}
                  {uploads.length > 0 && (
                    <div className="upload-previews">
                      {uploads.map((file, index) => (
                        <div key={`${file.name}-${file.lastModified}`}>
                          <img src={previews[index]} alt={`Preview of ${file.name}`} />
                          <span>{file.name}</span>
                          <button
                            type="button"
                            aria-label={`Remove ${file.name}`}
                            onClick={() =>
                              setUploads((current) => current.filter((_, i) => i !== index))
                            }
                          >
                            <X size={15} aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="wizard-hint">
                    Images are optional. You can continue without adding a reference.
                  </p>
                </section>
              )}
              {step === 2 && (
                <section>
                  <span className="eyebrow">STEP 03 · READY TO BEGIN</span>
                  <h2>Review your request</h2>
                  <p>Check the details before sending them to your atelier.</p>
                  <div className="review-card">
                    <div>
                      <small>SERVICE</small>
                      <b>
                        {services.find((service) => service._id === getValues('service'))?.name ||
                          getValues('service') ||
                          'Custom service'}
                      </b>
                    </div>
                    {!customerMode && (
                      <div>
                        <small>GARMENT</small>
                        <b>{getValues('description') || '—'}</b>
                      </div>
                    )}
                    <div>
                      <small>QUANTITY</small>
                      <b>{getValues('quantity') || 1}</b>
                    </div>
                    <div>
                      <small>EXPECTED COMPLETION</small>
                      <b>{getValues('dueDate') ? date(getValues('dueDate')) : '—'}</b>
                    </div>
                    <div>
                      <small>REFERENCE IMAGES</small>
                      <b>
                        {uploads.length
                          ? `${uploads.length} image${uploads.length > 1 ? 's' : ''} attached`
                          : 'None added'}
                      </b>
                    </div>
                  </div>
                  <p className="wizard-hint">
                    Final pricing and payment balance are confirmed by the atelier.
                  </p>
                </section>
              )}
              <div className="wizard-actions">
                {step > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => setStep((current) => current - 1)}
                    icon={ArrowLeft}
                  >
                    Previous
                  </Button>
                )}
                {step < steps.length - 1 ? (
                  <Button onClick={nextStep}>
                    Continue <ArrowRight size={15} />
                  </Button>
                ) : (
                  <button
                    type="submit"
                    disabled={submitBusy}
                    className="button button-primary"
                  >
                    {submitBusy ? (
                      <>
                        <LoaderCircle size={16} className="animate-spin" />
                        Creating order…
                      </>
                    ) : (
                      <>
                        Create order <ArrowRight size={15} />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
            <aside className="order-aside">
              <span className="eyebrow">ORDER FLOW</span>
              <h3>What happens next?</h3>
              <ol>
                {[
                  'We confirm the details',
                  'Your tailor gets assigned',
                  'You can follow each stage',
                  'We’ll let you know when it’s ready',
                ].map((text, index) => (
                  <li key={text}>
                    <i>{index + 1}</i>
                    {text}
                  </li>
                ))}
              </ol>
              <p>Final pricing and payment balance are calculated by the server.</p>
            </aside>
          </form>
        </div>
      </>
    );

  const heading = assigned ? 'Assigned orders' : customerMode ? 'My orders' : 'Orders';
  return (
    <>
      <PageHeader
        eyebrow={assigned ? 'YOUR WORK QUEUE' : 'ATELIER WORKFLOW'}
        title={heading}
        subtitle={
          assigned
            ? 'Orders currently assigned to you.'
            : 'Every piece, from first pin to final pickup.'
        }
      >
        {user.role !== ROLES.TAILOR && (
          <Button to={`/app/${customerMode ? 'my-orders' : 'orders'}/new`} icon={Plus}>
            {customerMode ? 'Request a new order' : 'New order'}
          </Button>
        )}
      </PageHeader>
      <div className="filterbar">
        <SearchBox
          value={search}
          onChange={(value) => {
            setPage(1);
            setSearch(value);
          }}
          placeholder="Search by order number..."
        />
        <label>
          Status{' '}
          <select
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
          >
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <span>
          <Filter size={14} /> {meta?.total ?? 0} records
        </span>
      </div>
      {busy ? (
        <Loading />
      ) : rows.length ? (
        <div className="card table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ORDER</th>
                {!customerMode && <th>CUSTOMER</th>}
                <th>ITEMS</th>
                <th>DUE DATE</th>
                <th>TOTAL</th>
                <th>BALANCE</th>
                <th>STATUS</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => (
                <tr key={order._id}>
                  <td>
                    <b className="order-number">{order.orderNumber}</b>
                  </td>
                  {!customerMode && <td>{order.customer?.name || '—'}</td>}
                  <td>{order.items?.map((item) => item.description).join(', ')}</td>
                  <td>{date(order.dueDate)}</td>
                  <td>{money(order.finalAmount)}</td>
                  <td>{money(order.remainingAmount)}</td>
                  <td>
                    <StatusBadge value={order.status} />
                  </td>
                  <td>
                    <Link
                      className="icon-link"
                      to={`/app/${assigned ? 'assigned' : customerMode ? 'my-orders' : 'orders'}/${order._id}`}
                      aria-label={`Open order ${order.orderNumber}`}
                    >
                      <ArrowRight size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination meta={meta} onPage={setPage} />
        </div>
      ) : (
        <EmptyState
          title="No orders to show"
          text="Try adjusting your filters or create the first order."
          action={
            user.role !== ROLES.TAILOR ? (
              <Button to={`/app/${customerMode ? 'my-orders' : 'orders'}/new`}>
                Create an order
              </Button>
            ) : null
          }
        />
      )}
    </>
  );
}
