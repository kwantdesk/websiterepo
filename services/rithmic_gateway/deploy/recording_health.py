"""Bounded recording diagnostics. Never restarts, deletes or changes feeds."""
def summarize_recording_health(health, previous=None):
    previous = previous or {}
    warnings = []
    writers = {}
    for key in ('recorder', 'tradeTape', 'chartHistory', 'exposure', 'recordedCashHistory'):
        row = health.get(key) or {}
        dropped = sum(v for v in (row.get('dropped') or {}).values() if isinstance(v, (int, float)))
        enabled = bool(row) if key == 'recordedCashHistory' else row.get('enabled') is True
        writers[key] = {'enabled': enabled, 'dropped': dropped, 'lastError': row.get('lastError')}
        if not writers[key]['enabled']:
            warnings.append('RECORDING_DISABLED: ' + key)
        if dropped:
            warnings.append('RECORDING_DROPPED: ' + key + ' ' + str(dropped))
        if row.get('lastError'):
            warnings.append('RECORDING_WRITE_ERROR: ' + key)
    recorder = health.get('recorder') or {}
    recorded = sum(v for v in (recorder.get('recorded') or {}).values() if isinstance(v, (int, float)))
    templates = health.get('templateCounts') or {}
    incoming = sum(templates.get(str(k), 0) for k in (116, 150, 151, 156, 160, 161))
    same_process = previous.get('startedAt') == recorder.get('startedAt')
    stalled = bool(same_process and incoming > previous.get('incoming', incoming)
                   and recorded <= previous.get('recorded', recorded))
    stalled_intervals = previous.get('stalledIntervals', 0) + 1 if stalled else 0
    if stalled_intervals >= 2:
        warnings.append('RECORDING_STALLED: market messages advance without raw writes')
    maximum = recorder.get('maxPendingBytes') or 0
    if maximum and any(v >= maximum * .75 for v in (recorder.get('pendingBytes') or {}).values()):
        warnings.append('RECORDING_BACKPRESSURE: raw writer nearing buffer limit')
    return {'startedAt': recorder.get('startedAt'), 'incoming': incoming, 'recorded': recorded,
            'stalledIntervals': stalled_intervals, 'writers': writers, 'warnings': warnings}
