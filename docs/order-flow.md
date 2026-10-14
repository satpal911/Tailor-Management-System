# Order and payment workflow

## Order lifecycle

The common progression is `PENDING → CONFIRMED → ASSIGNED → CUTTING → STITCHING → QUALITY_CHECK → READY → OUT_FOR_DELIVERY → DELIVERED → COMPLETED`. The transition map in `backend/src/constants/orderStatuses.js` is authoritative and may permit cancellation from eligible pre-delivery states. Invalid transitions are rejected. Admins may confirm/assign; the assigned tailor may move work through the allowed production states. Every accepted change records status, actor, time, and note in order history.

Customers select an available service and submit item details, due date, optional measurement, and reference images. The API uses catalog pricing rather than trusting client totals. Admin assignment links a shop tailor profile; tailor access is constrained to assigned orders and related customer measurements. Order details retain item and measurement references for work context.

## Payment workflow

Payments are offline shop-entered ledger records; the app does not transfer money or process online checkout. Customers pay the shop directly using the agreed cash, UPI, or bank-transfer method. An administrator records a payment only after confirming receipt; the order page links directly to the payment form with the remaining balance prefilled. The API recomputes the order balance and rejects non-positive or over-balance amounts. Partial payments leave a balance; payment status is derived from paid/refunded amounts. Refund records are separate ledger entries and admin-only.

Salary payouts work the same way: the administrator pays the tailor outside the app, then records the amount, method, and optional reference under **Salaries & payroll**. Tailors can view their current-month salary, breakdown, payment status, and payout history under **My salary**.

## Cancellation and notifications

Cancellation must follow the status transition map. Status changes create in-app notifications for relevant participants and publish minimal Socket.IO events to the customer, assigned tailor, creator, and admin rooms. Notification delivery is in-app; email/SMS delivery requires an external provider integration.
