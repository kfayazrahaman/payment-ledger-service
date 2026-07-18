
import Invoice from '../models/Invoice.js';
import LineItem from '../models/LineItem.js';
import mongoose from '../config/database.js';

export async function createInvoice(
  invoiceNumber,
  accountId,
  dueDate = null,
  lineItems = []
) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Calculate total from line items
    const totalCents = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);

    if (totalCents <= 0) {
      throw new Error('Invoice total must be greater than zero');
    }

    // Create invoice document within session
    const [invoice] = await Invoice.create([{
      invoiceNumber: invoiceNumber?.trim()?.toUpperCase(),
      accountId,
      dueDate: dueDate ? new Date(dueDate) : null,
      totalCents: Math.floor(totalCents || 0),
      paidCents: 0,
      status: 'DRAFT',
    }], { session });

    console.log(
      `Invoice created: ${invoiceNumber} - $${(totalCents / 100).toFixed(2)}`
    );

    // Create line items for this invoice within session
    if (lineItems.length > 0) {
      const lineItemDocs = lineItems.map((item) => ({
        invoiceId: invoice?._id,
        description: item?.description?.trim(),
        amountCents: Math.floor(item?.amount || 0),
      }));

      await LineItem.insertMany(lineItemDocs, { session });
      console.log(`${lineItems.length} line items added to invoice`);
    }

    await session.commitTransaction();
    session.endSession();

    // Fetch invoice with line items populated
    return getInvoice(invoice?._id);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    
    // Handle specific validation errors
    console.log("error object",error)
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors)
        .map((err) => err.message)
        .join(', ');
      throw new Error(`Invoice validation failed: ${messages}`);
    }
    // Handle duplicate invoice number
    if (error.code === 11000) {
      throw new Error(
        `Invoice number already exists: ${invoiceNumber}`
      );
    }
    throw error;
  }
}

export async function getInvoice(id) {
  try {
    // findById and populate related documents
    const invoice = await Invoice.findById(id)
      .populate('accountId', 'name type')
      .lean(); // .lean() returns plain objects (faster for read-only)

    if (!invoice) {
      console.warn(` Invoice not found: ${id}`);
      return null;
    }

    // Fetch associated line items
    // Note: We keep line items in separate collection for better query flexibility
    const lineItems = await LineItem.find({ invoiceId: id }).lean();

    console.log('getInvoice retrieved:',{
      ...invoice,
      lineItems,
    })

    // Return invoice with line items included
    return {
      ...invoice,
      lineItems,
    };
  } catch (error) {
    if (error.name === 'CastError') {
      throw new Error(`Invalid invoice ID format: ${id}`);
    }
    throw error;
  }
}

export async function getAllInvoices(status = null) {
  try {
    let query = Invoice.find({});

    // Apply status filter if provided
    if (status) {
      query = query.where('status').equals(status.toUpperCase());
    }

    // Sort by creation date (newest first)
    const invoices = await query
      .populate('accountId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    console.log(`Retrieved ${invoices.length} invoices`);
    return invoices;
  } catch (error) {
    throw error;
  }
}

export async function updateInvoiceStatus(invoiceId, status, session = null) {
  try {
    // findByIdAndUpdate modifies document and returns it
    // { new: true } returns updated document
    // { runValidators: true } validates against schema
    const options = { new: true, runValidators: true };
    if (session) options.session = session;

    const invoice = await Invoice.findByIdAndUpdate(
      invoiceId,
      { status: status.toUpperCase() },
      options
    )
      .populate('accountId', 'name')
      .lean();

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    console.log(`Invoice ${invoiceId} status updated to: ${status}`);
    return invoice;
  } catch (error) {
    if (error.name === 'CastError') {
      throw new Error(`Invalid invoice ID format: ${invoiceId}`);
    }
    if (error.name === 'ValidationError') {
      throw new Error(`Invalid status: ${status}`);
    }
    throw error;
  }
}

export async function getInvoicePaidAmount(invoiceId) {
  try {
    const invoice = await Invoice.findById(invoiceId).select('paidCents');

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    return invoice.paidCents || 0;
  } catch (error) {
    throw error;
  }
}

export async function getInvoiceLineItems(invoiceId) {
  try {
    const lineItems = await LineItem.find({ invoiceId })
      .sort({ createdAt: 1 })
      .lean();

    return lineItems;
  } catch (error) {
    throw error;
  }
}

export async function updateInvoicePaidAmount(invoiceId, amountCents) {
  try {
    // $inc operator: increments paidCents by the specified amount
    const invoice = await Invoice.findByIdAndUpdate(
      invoiceId,
      { $inc: { paidCents: amountCents } },
      { new: true }
    );

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    return invoice;
  } catch (error) {
    throw error;
  }
}
