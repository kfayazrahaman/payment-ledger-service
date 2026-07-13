/**
 * Invoice Service - Mongoose Version
 * 
 * Handles all invoice-related operations:
 * - Creating invoices with line items
 * - Fetching and querying invoices
 * - Updating invoice status
 * - Tracking paid amounts
 * 
 * Key Differences from SQLite Version:
 * - Uses Mongoose Invoice and LineItem models
 * - Line items are separate documents (instead of separate SQL inserts)
 * - Virtual properties for calculated fields (remaining amount)
 * - Schema validation for status and amounts
 * - Automatic index lookups for common queries
 */

import Invoice from '../models/Invoice.js';
import LineItem from '../models/LineItem.js';

/**
 * Create a new invoice with line items
 * 
 * Previously (SQLite):
 * 1. INSERT invoice into invoices table
 * 2. INSERT each line item into invoice_line_items table
 * 
 * Now (Mongoose):
 * 1. Create Invoice document
 * 2. Create LineItem documents (separate but linked via invoiceId)
 * 
 * @param {string} invoiceNumber - Unique invoice number (e.g., "INV-001")
 * @param {string} accountId - MongoDB ObjectId of customer account
 * @param {string} [dueDate] - ISO date string for when payment is due
 * @param {Array} [lineItems] - Array of line items: [{description, amount}, ...]
 * @returns {Promise<Object>} - Created invoice document with lineItems populated
 * @throws {Error} - If validation fails or invoice number already exists
 */
export async function createInvoice(
  invoiceNumber,
  accountId,
  dueDate = null,
  lineItems = []
) {
  try {
    // Calculate total from line items
    // Amount field in the input is already in cents
    const totalCents = lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);

    if (totalCents <= 0) {
      throw new Error('Invoice total must be greater than zero');
    }

    // Create invoice document
    const invoice = await Invoice.create({
      invoiceNumber: invoiceNumber?.trim()?.toUpperCase(),
      accountId,
      dueDate: dueDate ? new Date(dueDate) : "",
      totalCents: Math.floor(totalCents || 0),
      paidCents: 0,
      status: 'DRAFT',
    });

    console.log(
      `✅ Invoice created: ${invoiceNumber} - $${(totalCents / 100).toFixed(2)}`
    );

    // Create line items for this invoice
    if (lineItems.length > 0) {
      const lineItemDocs = lineItems.map((item) => ({
        invoiceId: invoice?._id,
        description: item?.description?.trim(),
        amountCents: Math.floor(item?.amount || 0),
      }));

      // Insert all line items in one batch operation
      await LineItem.insertMany(lineItemDocs);
      console.log(`✅ ${lineItems.length} line items added to invoice`);
    }

    // Fetch invoice with line items populated
    return getInvoice(invoice?._id);
  } catch (error) {
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

/**
 * Get a single invoice by ID
 * 
 * Previously (SQLite):
 * - SELECT from invoices table by id
 * - Separate query to SELECT from invoice_line_items
 * 
 * Now (Mongoose):
 * - findById returns invoice document
 * - Can optionally populate related line items
 * 
 * @param {string} id - Invoice MongoDB ObjectId
 * @returns {Promise<Object|null>} - Invoice document with line items or null
 * @throws {Error} - If database error occurs
 */
export async function getInvoice(id) {
  try {
    // findById and populate related documents
    const invoice = await Invoice.findById(id)
      .populate('accountId', 'name type')
      .lean(); // .lean() returns plain objects (faster for read-only)

    if (!invoice) {
      console.warn(`⚠️ Invoice not found: ${id}`);
      return null;
    }

    // Fetch associated line items
    // Note: We keep line items in separate collection for better query flexibility
    const lineItems = await LineItem.find({ invoiceId: id }).lean();

    console.log('✅ getInvoice retrieved:',{
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

/**
 * Get all invoices, optionally filtered by status
 * 
 * Previously (SQLite):
 * ```sql
 * SELECT * FROM invoices 
 * WHERE status = ? (optional)
 * ORDER BY created_at DESC
 * ```
 * 
 * Now (Mongoose):
 * - find() with optional status filter
 * - Supports sorting and pagination
 * 
 * @param {string} [status] - Optional status filter (DRAFT, SENT, PAID, OVERDUE)
 * @returns {Promise<Array>} - Array of invoice documents
 * @throws {Error} - If database error occurs
 */
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

    console.log(`✅ Retrieved ${invoices.length} invoices`);
    return invoices;
  } catch (error) {
    throw error;
  }
}

/**
 * Update invoice status
 * 
 * Previously (SQLite):
 * ```sql
 * UPDATE invoices 
 * SET status = ?, updated_at = CURRENT_TIMESTAMP 
 * WHERE id = ?
 * ```
 * 
 * Now (Mongoose):
 * - findByIdAndUpdate() updates document and returns updated version
 * - Mongoose automatically updates updatedAt timestamp
 * 
 * @param {string} invoiceId - Invoice MongoDB ObjectId
 * @param {string} status - New status (DRAFT, SENT, PAID, OVERDUE)
 * @returns {Promise<Object>} - Updated invoice document
 * @throws {Error} - If invoice not found or status is invalid
 */
export async function updateInvoiceStatus(invoiceId, status) {
  try {
    // findByIdAndUpdate modifies document and returns it
    // { new: true } returns updated document
    // { runValidators: true } validates against schema
    const invoice = await Invoice.findByIdAndUpdate(
      invoiceId,
      { status: status.toUpperCase() },
      { new: true, runValidators: true }
    )
      .populate('accountId', 'name')
      .lean();

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    console.log(`✅ Invoice ${invoiceId} status updated to: ${status}`);
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

/**
 * Get total paid amount for an invoice
 * 
 * Previously (SQLite):
 * ```sql
 * SELECT COALESCE(SUM(amount_cents), 0) as total 
 * FROM payments 
 * WHERE invoice_id = ? AND status = 'COMPLETED'
 * ```
 * 
 * Now (Mongoose):
 * - Direct field access since paidCents is stored on invoice
 * 
 * @param {string} invoiceId - Invoice MongoDB ObjectId
 * @returns {Promise<number>} - Total paid amount in cents
 * @throws {Error} - If invoice not found
 */
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

/**
 * Get line items for an invoice
 * 
 * Previously (SQLite):
 * ```sql
 * SELECT * FROM invoice_line_items 
 * WHERE invoice_id = ? 
 * ORDER BY created_at ASC
 * ```
 * 
 * Now (Mongoose):
 * - Query LineItem collection by invoiceId
 * 
 * @param {string} invoiceId - Invoice MongoDB ObjectId
 * @returns {Promise<Array>} - Array of line item documents
 * @throws {Error} - If database error occurs
 */
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

/**
 * Update invoice paid amount
 * 
 * New method in Mongoose version
 * Called when a payment is applied to an invoice
 * 
 * @param {string} invoiceId - Invoice MongoDB ObjectId
 * @param {number} amountCents - Amount to add to paidCents
 * @returns {Promise<Object>} - Updated invoice document
 * @throws {Error} - If invoice not found
 */
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
