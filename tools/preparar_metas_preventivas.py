"""Importa denominadores y puente CLUES existentes del evaluador; no recalcula equivalencias."""
import argparse,csv,json
from pathlib import Path

def preparar(raiz,anio):
    with (raiz/'catalogos/catalogo_unidades.csv').open(encoding='utf-8-sig',newline='') as f:
        puente=[{k:r[k].strip() for k in ('clues_metas','clues_sis')} for r in csv.DictReader(f) if r['clues_sis'].strip()]
    metas=[];vistos=set()
    with (raiz/'salida/metas_largo.csv').open(encoding='utf-8-sig',newline='') as f:
        for r in csv.DictReader(f):
            if r['id_meta'] not in ('01.02.02.01','01.02.02.02'):continue
            key=(r['clues_metas'],r['id_meta'],r['mes'])
            if key in vistos:raise ValueError('Meta mensual duplicada')
            vistos.add(key)
            metas.append({'unidad_id':r['clues_metas'],'periodo':f"{anio}-{int(r['mes']):02d}",'id_meta':r['id_meta'],'meta':float(r['meta_programada']),'medida':r['unidad_medida']})
    avances=[]
    ruta=raiz/'salida/evaluacion_mensual.csv'
    if ruta.exists():
        with ruta.open(encoding='utf-8-sig',newline='') as f:
            for r in csv.DictReader(f):
                if r['id_meta']!='01.02.02.02':continue
                valor=r['avance'].strip()
                avances.append({'unidad_id':r['clues_metas'],'periodo':f"{anio}-{int(r['mes']):02d}",'id_meta':r['id_meta'],'avance':float(valor) if valor and r['estatus_fuente']=='OK' else None,'estado_fuente':'OBSERVADO' if r['estatus_fuente']=='OK' else r['estatus_fuente'],'corte':None})
    return {'version':1,'anio':anio,'corte':None,'origen':'Metas 2026 por Unidad Médica DEFINITIVO; metas_largo.csv, evaluacion_mensual.csv y catálogo de unidades existente','puente':puente,'metas':metas,'avances_oficiales':avances}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--evaluador',type=Path,required=True);p.add_argument('--anio',type=int,default=2026);p.add_argument('--salida',type=Path,required=True);a=p.parse_args()
    data=preparar(a.evaluador,a.anio);a.salida.parent.mkdir(parents=True,exist_ok=True);a.salida.write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8');print(f"Metas: {len(data['metas'])}; equivalencias existentes: {len(data['puente'])}")
