import {allocateProRata,buildSettlementPlan,settlementStatus} from './commerce.mjs';
export const RECONCILIATION_SCHEMA='yasready.marketplace.reconciliation.v1';

export function buildRefundAllocation(amountMinor,items=[]){
  const totalGross=items.reduce((s,x)=>s+Math.max(0,Number(x.grossMinor??x.gross_minor??0)),0);
  const sellerPool=Math.min(Math.max(0,Number(amountMinor)||0),totalGross);
  const parts=allocateProRata(sellerPool,items.map(x=>({grossMinor:Number(x.grossMinor??x.gross_minor??0)})));
  return items.map((item,i)=>({id:item.id,amountMinor:parts[i]||0}));
}

export function buildAuthorTransferPlan(settlements=[]){
  return settlements.filter(x=>x.status==='ready_to_transfer'&&Number(x.payable_minor??x.payableMinor)>0).map(x=>({settlementId:x.id,orderId:x.order_id??x.orderId,authorId:x.author_id??x.authorId,amountMinor:Number(x.payable_minor??x.payableMinor),currency:x.currency||'usd'}));
}

export function reconcileAllocation({allocation={},paymentStatus,hasDispute=false,providerReconciled=false,fulfillmentCostPending=false}={}){
  const plan=buildSettlementPlan(allocation);
  return {...plan,transferredMinor:Number(allocation.transferredMinor||0),status:settlementStatus({paymentStatus,hasDispute,providerReconciled,fulfillmentCostPending,payableMinor:plan.payableMinor,transferredMinor:allocation.transferredMinor,refundedMinor:plan.refundedMinor}),schema:RECONCILIATION_SCHEMA};
}

export function exceptionSeverity(code=''){
  if(/dispute|negative_balance|transfer_reversal|payment_failed|fulfillment_failed/.test(code)) return 'critical';
  if(/reconcile|requirement|cost|tracking|refund/.test(code)) return 'warning';
  return 'info';
}

export function summarizeCommerceHealth({settlements=[],exceptions=[],jobs=[]}={}){
  const open=exceptions.filter(x=>['open','acknowledged'].includes(x.status));
  return {schema:'yasready.marketplace.commerce-health.v1',settlements:{total:settlements.length,ready:settlements.filter(x=>x.status==='ready_to_transfer').length,onHold:settlements.filter(x=>String(x.status).startsWith('hold_')).length,awaitingCost:settlements.filter(x=>x.status==='awaiting_fulfillment_cost').length},exceptions:{open:open.length,critical:open.filter(x=>x.severity==='critical').length},jobs:{queued:jobs.filter(x=>x.status==='queued').length,failed:jobs.filter(x=>x.status==='failed').length}};
}
