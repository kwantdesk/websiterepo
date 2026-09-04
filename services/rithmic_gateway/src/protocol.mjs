import { join } from "node:path";
import protobuf from "protobufjs";

const PROTO_FILES = [
  "message_type.proto",
  "request_rithmic_system_info.proto",
  "response_rithmic_system_info.proto",
  "request_login.proto",
  "response_login.proto",
  "request_logout.proto",
  "response_logout.proto",
  "request_heartbeat.proto",
  "response_heartbeat.proto",
  "request_market_data_update.proto",
  "response_market_data_update.proto",
  "last_trade.proto",
  "best_bid_offer.proto",
  "order_book.proto",
  "request_depth_by_order_snapshot.proto",
  "response_depth_by_order_snapshot.proto",
  "request_depth_by_order_updates.proto",
  "response_depth_by_order_updates.proto",
  "depth_by_order.proto",
  "depth_by_order_end_event.proto",
  "request_front_month_contract.proto",
  "response_front_month_contract.proto",
  "request_time_bar_replay.proto",
  "response_time_bar_replay.proto",
  "request_tick_bar_replay.proto",
  "response_tick_bar_replay.proto",
  "request_volume_profile_minute_bars.proto",
  "response_volume_profile_minute_bars.proto"
];

const RESPONSE_TYPES = new Map([
  [11, "ResponseLogin"],
  [13, "ResponseLogout"],
  [17, "ResponseRithmicSystemInfo"],
  [19, "ResponseHeartbeat"],
  [101, "ResponseMarketDataUpdate"],
  [116, "ResponseDepthByOrderSnapshot"],
  [118, "ResponseDepthByOrderUpdates"],
  [150, "LastTrade"],
  [151, "BestBidOffer"],
  [156, "OrderBook"],
  [160, "DepthByOrder"],
  [161, "DepthByOrderEndEvent"],
  [203, "ResponseTimeBarReplay"],
  [207, "ResponseTickBarReplay"],
  [209, "ResponseVolumeProfileMinuteBars"],
  [154467, "ResponseFrontMonthContract"]
]);

function jsonValue(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(jsonValue);
  if (typeof value === "object") {
    if (
      typeof value.toString === "function" &&
      Object.prototype.hasOwnProperty.call(value, "low") &&
      Object.prototype.hasOwnProperty.call(value, "high")
    ) {
      return value.toString();
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, jsonValue(entry)]),
    );
  }
  return value;
}

export function loadProtocol(protoDir) {
  const root = new protobuf.Root();
  root.loadSync(PROTO_FILES.map((file) => join(protoDir, file)));
  root.resolveAll();

  function type(name) {
    return root.lookupType(`rti.${name}`);
  }

  return {
    root,
    encode(name, value) {
      const messageType = type(name);
      const error = messageType.verify(value);
      if (error) throw new Error(`${name}: ${error}`);
      return Buffer.from(messageType.encode(messageType.create(value)).finish());
    },
    templateId(buffer) {
      return type("MessageType").decode(buffer).templateId;
    },
    decode(buffer) {
      const templateId = this.templateId(buffer);
      const typeName = RESPONSE_TYPES.get(templateId);
      if (!typeName) {
        /*
         * A message type we cannot name yet. Keep the WIRE BYTES.
         *
         * Widening the subscription brought in settlement, open interest,
         * market mode, the price limits and the official open and close - real
         * market data, arriving now, whose template ids Rithmic does not
         * publish in the .proto files. Returning a null payload recorded only
         * that something happened, which is precisely the failure the archive
         * exists to prevent, and the bytes were then gone for good.
         *
         * Guessing a mapping would be worse than the gap: a wrong message
         * type decodes into confident nonsense. So the bytes are kept
         * verbatim. Rithmic derives field numbers from a global id space, so
         * the set of numbers in a message identifies which message it is - and
         * that can be worked out offline from these bytes, then applied
         * retroactively to everything recorded in the meantime. Nothing is
         * lost while the mapping is established.
         */
        return {
          templateId,
          typeName: null,
          payload: null,
          raw: Buffer.from(buffer).toString("base64"),
        };
      }
      const messageType = type(typeName);
      const decoded = messageType.decode(buffer);
      return {
        templateId,
        typeName,
        payload: jsonValue(
          messageType.toObject(decoded, {
            defaults: false,
            arrays: true,
            longs: String,
            enums: Number,
          }),
        ),
      };
    },
  };
}

export const TEMPLATE_IDS = Object.freeze({
  LOGIN_REQUEST: 10,
  LOGIN_RESPONSE: 11,
  LOGOUT_REQUEST: 12,
  SYSTEM_INFO_REQUEST: 16,
  SYSTEM_INFO_RESPONSE: 17,
  HEARTBEAT_REQUEST: 18,
  MARKET_DATA_REQUEST: 100,
  DEPTH_SNAPSHOT_REQUEST: 115,
  DEPTH_UPDATES_REQUEST: 117,
  FRONT_MONTH_REQUEST: 154467,
  FRONT_MONTH_RESPONSE: 154467,
  TIME_BAR_REPLAY_REQUEST: 202,
  TIME_BAR_REPLAY_RESPONSE: 203,
  TICK_BAR_REPLAY_REQUEST: 206,
  TICK_BAR_REPLAY_RESPONSE: 207,
  VOLUME_PROFILE_REPLAY_REQUEST: 208,
  VOLUME_PROFILE_REPLAY_RESPONSE: 209,
});
