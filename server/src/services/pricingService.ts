import { PricingConfig, PrintColor, PrintSide } from '../types';

const defaultPricing: PricingConfig = {
  blackWhiteSingle: 0.1,
  blackWhiteDouble: 0.15,
  colorSingle: 1.0,
  colorDouble: 1.5,
};

let currentPricing: PricingConfig = { ...defaultPricing };

export function getPricing(): PricingConfig {
  return { ...currentPricing };
}

export function setPricing(pricing: Partial<PricingConfig>): PricingConfig {
  currentPricing = { ...currentPricing, ...pricing };
  return { ...currentPricing };
}

export function calculatePrice(
  pageCount: number,
  color: PrintColor,
  side: PrintSide,
  copies: number
): number {
  if (pageCount <= 0 || copies <= 0) {
    return 0;
  }

  let pricePerPage: number;

  if (color === 'black_white' && side === 'single') {
    pricePerPage = currentPricing.blackWhiteSingle;
  } else if (color === 'black_white' && side === 'double') {
    pricePerPage = currentPricing.blackWhiteDouble;
  } else if (color === 'color' && side === 'single') {
    pricePerPage = currentPricing.colorSingle;
  } else {
    pricePerPage = currentPricing.colorDouble;
  }

  const totalPrice = pricePerPage * pageCount * copies;
  return Math.round(totalPrice * 100) / 100;
}

export function calculateTotalPages(
  pageCount: number,
  side: PrintSide,
  copies: number
): number {
  if (side === 'single') {
    return pageCount * copies;
  } else {
    return Math.ceil(pageCount / 2) * copies;
  }
}

export function calculateRefundAmount(
  totalAmount: number,
  totalPages: number,
  printedPages: number
): number {
  if (printedPages <= 0) {
    return totalAmount;
  }
  if (printedPages >= totalPages) {
    return 0;
  }
  
  const refundRatio = 1 - (printedPages / totalPages);
  const refundAmount = totalAmount * refundRatio;
  return Math.round(refundAmount * 100) / 100;
}
