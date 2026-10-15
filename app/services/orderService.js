/**
 * Order Placement Service for In-Chat Checkout
 * Creates and completes orders in Shopify Admin via GraphQL API.
 * Ensures orders appear directly in Shopify Admin -> Orders without redirecting to standard checkout.
 */

const DRAFT_ORDER_CREATE_MUTATION = `#graphql
  mutation draftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder {
        id
        name
        totalPrice
        invoiceUrl
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const DRAFT_ORDER_COMPLETE_MUTATION = `#graphql
  mutation draftOrderComplete($id: ID!, $paymentPending: Boolean) {
    draftOrderComplete(id: $id, paymentPending: $paymentPending) {
      draftOrder {
        id
        name
        order {
          id
          name
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Creates an order directly from the in-chat checkout form.
 *
 * @param {object} admin - Authenticated Shopify Admin GraphQL client
 * @param {object} customer - Customer contact and shipping information
 * @param {Array} items - Cart line items
 * @returns {Promise<{ success: boolean, orderNumber: string, orderId: string, isOfficialOrder: boolean, totalPrice: string }>}
 */
export async function createChatOrder(admin, customer = {}, items = []) {
  if (!admin) {
    throw new Error("Shopify Admin API client is required to register an order.");
  }

  if (!items || items.length === 0) {
    throw new Error("Cannot place an order with an empty shopping cart.");
  }

  const lineItems = items.map((item) => {
    const rawVariantId = String(item.variantId || item.id || "");
    const formattedId = rawVariantId.startsWith("gid://")
      ? rawVariantId
      : `gid://shopify/ProductVariant/${rawVariantId}`;

    return {
      variantId: formattedId,
      quantity: Math.max(1, parseInt(item.quantity, 10) || 1)
    };
  });

  const isCod = (customer.paymentMethod || "COD").toUpperCase() === "COD";
  const firstName = customer.firstName?.trim() || "Customer";
  const lastName = customer.lastName?.trim() || "";
  const phone = customer.phone?.trim() || undefined;
  const email = customer.email?.trim() || undefined;
  const address1 = customer.address1?.trim() || "Address Not Provided";
  const address2 = customer.address2?.trim() || "";
  const city = customer.city?.trim() || "Lahore";
  const province = customer.province?.trim() || "Punjab";
  const zip = customer.zip?.trim() || "";
  const notes = customer.notes?.trim() || "";

  const draftInput = {
    email: email,
    phone: phone,
    note: `Order via Muasa AI Chatbot (${isCod ? "Cash on Delivery" : "Online Payment"})\nCustomer Instructions: ${notes || "None"}`,
    tags: [
      "Muasa AI Chatbot",
      isCod ? "COD" : "Online Payment",
      "In-Chat Checkout"
    ],
    shippingAddress: {
      firstName,
      lastName,
      address1,
      address2,
      city,
      province,
      zip,
      country: "Pakistan",
      phone
    },
    billingAddress: {
      firstName,
      lastName,
      address1,
      address2,
      city,
      province,
      zip,
      country: "Pakistan",
      phone
    },
    lineItems,
    customAttributes: [
      { key: "Order Source", value: "Muasa AI Chatbot" },
      { key: "Payment Method", value: isCod ? "Cash on Delivery (COD)" : "Online Card" }
    ]
  };

  const createRes = await admin.graphql(DRAFT_ORDER_CREATE_MUTATION, {
    variables: { input: draftInput }
  });

  const createJson = await createRes.json();
  if (createJson.errors && createJson.errors.length > 0) {
    console.error("[OrderService] GraphQL errors on draftOrderCreate:", createJson.errors);
    throw new Error(createJson.errors[0]?.message || "Shopify GraphQL error");
  }

  const draftData = createJson.data?.draftOrderCreate;
  if (draftData?.userErrors && draftData.userErrors.length > 0) {
    console.error("[OrderService] User errors on draftOrderCreate:", draftData.userErrors);
    throw new Error(draftData.userErrors[0]?.message || "Failed to create draft order");
  }

  const draftOrder = draftData?.draftOrder;
  if (!draftOrder?.id) {
    throw new Error("Shopify did not return a valid draft order.");
  }

  // Complete draft order directly to convert it into an official Order in Shopify Admin -> Orders
  try {
    const completeRes = await admin.graphql(DRAFT_ORDER_COMPLETE_MUTATION, {
      variables: {
        id: draftOrder.id,
        paymentPending: true
      }
    });

    const completeJson = await completeRes.json();
    const completeData = completeJson.data?.draftOrderComplete;

    if (completeData?.order?.name) {
      console.log(`[OrderService] Official Shopify order created: ${completeData.order.name}`);
      return {
        success: true,
        orderNumber: completeData.order.name,
        orderId: completeData.order.id,
        isOfficialOrder: true,
        totalPrice: draftOrder.totalPrice
      };
    }
  } catch (completeErr) {
    console.warn("[OrderService] Draft order completion warning:", completeErr.message);
  }

  // Fallback to draft order number if auto-completion requires manual review
  return {
    success: true,
    orderNumber: draftOrder.name,
    orderId: draftOrder.id,
    isOfficialOrder: false,
    totalPrice: draftOrder.totalPrice
  };
}
