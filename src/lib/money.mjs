export function marketplaceFee(grossMinor,bps=500){return Math.round(grossMinor*(bps/10000));}
export function sellerPayable({grossMinor,fulfillmentMinor=0,stripeFeeMinor=0,taxMinor=0,refundMinor=0,feeBps=500}){
  const marketplaceFeeMinor=marketplaceFee(grossMinor,feeBps);
  return {marketplaceFeeMinor,sellerPayableMinor:grossMinor-fulfillmentMinor-stripeFeeMinor-taxMinor-refundMinor-marketplaceFeeMinor};
}
