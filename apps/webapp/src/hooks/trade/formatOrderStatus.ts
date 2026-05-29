import { OrderStatus } from './constants';

export const formatOrderStatus = (orderStatus: OrderStatus) => {
  switch (orderStatus) {
    case OrderStatus.presignaturePending:
      return 'Signature Pending';
    case OrderStatus.cancelled:
      return 'Cancelled';
    case OrderStatus.expired:
      return 'Expired';
    case OrderStatus.fulfilled:
      return 'Fulfilled';
    case OrderStatus.open:
    default:
      return 'Open';
  }
};
