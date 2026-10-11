const { getTicketModel } = require('../models/Ticket');
const { getOrderModel } = require('../models/Order');
const { getUserModel } = require('../models/User');
const realtime = require('../utils/realtime');

// @desc    Create a new support ticket
// @route   POST /api/tickets
const createTicket = async (req, res) => {
  const { subject, description, orderId, priority } = req.body;

  if (!subject || !description) {
    return res.status(400).json({ message: 'Subject and description are required.' });
  }

  try {
    const Ticket = getTicketModel();
    const Order = getOrderModel();

    if (orderId) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(orderId))) {
        return res.status(400).json({ message: 'That order could not be found. Please pick it from your orders list.' });
      }
      const order = await Order.findByPk(orderId);
      if (!order || order.userId !== req.user.id) {
        return res.status(404).json({ message: 'Order not found or access denied.' });
      }
    }

    let slaHours = 12; // Default Medium
    const prio = priority || 'Medium';
    if (prio === 'Critical') slaHours = 2;
    else if (prio === 'High') slaHours = 4;
    else if (prio === 'Low') slaHours = 24;
    
    const breachTime = new Date();
    breachTime.setHours(breachTime.getHours() + slaHours);

    const ticket = await Ticket.create({
      userId: req.user.id,
      orderId: orderId || null,
      subject,
      description,
      priority: prio,
      status: 'Open',
      slaBreachAt: breachTime
    });

    realtime.notifyAdmin('ticket', 'created', ticket.id);
    res.status(201).json(ticket);
  } catch (error) {
    console.error('[CREATE_TICKET_ERROR]', error);
    res.status(500).json({ message: 'Something went wrong on our side. Please try again in a moment.' });
  }
};

// @desc    Get user's tickets
// @route   GET /api/tickets
const getMyTickets = async (req, res) => {
  try {
    const Ticket = getTicketModel();
    const Order = getOrderModel();

    const tickets = await Ticket.findAll({
      where: { userId: req.user.id },
      include: [{ model: Order, as: 'order', attributes: ['id', 'status', 'createdAt', 'totalPrice'] }],
      order: [['createdAt', 'DESC']]
    });

    res.json(tickets);
  } catch (error) {
    console.error('[GET_TICKETS_ERROR]', error);
    res.status(500).json({ message: 'Something went wrong on our side. Please try again in a moment.' });
  }
};

// @desc    Get all tickets (Admin)
// @route   GET /api/tickets/admin
const getAllTickets = async (req, res) => {
  try {
    const Ticket = getTicketModel();
    const User = getUserModel();

    const tickets = await Ticket.findAll({
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'phone'] }],
      order: [['createdAt', 'DESC']]
    });

    // Rider tickets (riderId, no userId): show the rider as the requester.
    const riderIds = [...new Set(tickets.filter(t => !t.userId && t.riderId).map(t => t.riderId))];
    let riderMap = {};
    if (riderIds.length) {
      const { getDeliveryPartnerModel } = require('../models/DeliveryPartner');
      const riders = await getDeliveryPartnerModel().findAll({ where: { id: riderIds }, attributes: ['id', 'name', 'phone'] });
      riderMap = Object.fromEntries(riders.map(r => [r.id, r]));
    }
    res.json(tickets.map(t => {
      const json = t.toJSON();
      const rider = json.riderId ? riderMap[json.riderId] : null;
      if (!json.user && rider) json.user = { id: rider.id, name: `Rider: ${rider.name}`, phone: rider.phone };
      return { ...json, requesterRole: json.riderId && !json.userId ? 'rider' : 'customer' };
    }));
  } catch (error) {
    console.error('[GET_ALL_TICKETS_ERROR]', error);
    res.status(500).json({ message: 'Something went wrong on our side. Please try again in a moment.' });
  }
};

// @desc    Update ticket status/response (Admin)
// @route   PUT /api/tickets/:id
const updateTicket = async (req, res) => {
  const { status, adminResponse } = req.body;

  try {
    const Ticket = getTicketModel();
    const ticket = await Ticket.findByPk(req.params.id);

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const previousStatus = ticket.status;
    const previousResponse = ticket.adminResponse;
    if (status) ticket.status = status;
    if (adminResponse) ticket.adminResponse = adminResponse;

    await ticket.save();
    realtime.notifyAdmin('ticket', 'updated', ticket.id);
    res.json(ticket);

    // Tell the customer (push + live) when support replies or changes the status.
    if (ticket.status !== previousStatus || (adminResponse && adminResponse !== previousResponse)) {
      try {
        const io = req.app.get('io');
        if (io && ticket.userId) io.to('user_' + ticket.userId).emit('ticket_updated', { id: ticket.id, status: ticket.status, adminResponse: ticket.adminResponse });
        const customer = ticket.userId ? await getUserModel().findByPk(ticket.userId, { attributes: ['id', 'fcmTokens'] }) : null;
        if (customer) {
          const { sendPushToTokens } = require('../utils/push');
          const title = adminResponse && adminResponse !== previousResponse ? '💬 Zenvy Support replied' : '🎫 Support ticket updated';
          const body = adminResponse && adminResponse !== previousResponse
            ? String(adminResponse).slice(0, 140)
            : 'Your ticket "' + String(ticket.subject || 'Support request').slice(0, 60) + '" is now ' + ticket.status + '.';
          await sendPushToTokens(customer.fcmTokens, title, body, { type: 'SUPPORT_TICKET', ticketId: String(ticket.id), status: String(ticket.status) }, { recipients: [ticket.userId] });
        }
        if (!ticket.userId && ticket.riderId) {
          // Rider ticket: live update + push to the rider app (rider tokens are { token, appVersion } objects).
          if (io) io.to('rider_' + ticket.riderId).emit('ticket_updated', { id: ticket.id, status: ticket.status, adminResponse: ticket.adminResponse });
          const { getDeliveryPartnerModel } = require('../models/DeliveryPartner');
          const rider = await getDeliveryPartnerModel().findByPk(ticket.riderId, { attributes: ['id', 'fcmTokens'] });
          const riderTokens = (Array.isArray(rider?.fcmTokens) ? rider.fcmTokens : []).map(t => (typeof t === 'string' ? t : t?.token)).filter(Boolean);
          if (riderTokens.length) {
            const { sendPushToTokens } = require('../utils/push');
            const replied = adminResponse && adminResponse !== previousResponse;
            await sendPushToTokens(
              riderTokens,
              replied ? 'Zenvy Support replied' : 'Support ticket updated',
              replied ? String(adminResponse).slice(0, 140) : 'Your ticket "' + String(ticket.subject || 'Support request').slice(0, 60) + '" is now ' + ticket.status + '.',
              { type: 'SUPPORT_TICKET', ticketId: String(ticket.id), status: String(ticket.status) },
              { persist: false }
            );
          }
        }
      } catch (notifyErr) {
        console.warn('[TICKET_NOTIFY_WARN]', notifyErr.message);
      }
    }
  } catch (error) {
    console.error('[UPDATE_TICKET_ERROR]', error);
    res.status(500).json({ message: 'Something went wrong on our side. Please try again in a moment.' });
  }
};

module.exports = { createTicket, getMyTickets, getAllTickets, updateTicket };
