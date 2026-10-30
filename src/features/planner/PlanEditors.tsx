import type { Catalog } from '../../domain/buildCatalog'
import {
  type NetworkPlan,
  type PlanLink,
  type PlanPort,
  type PlanSwitch,
  type PlanVlan,
  VLAN_PURPOSES,
} from '../../domain/networkPlan'
import { PURPOSE_LABELS } from '../labels'
import { PLAN_TEMPLATES } from './planTemplates'
import { nextId } from './usePlan'
import { interfaceParam } from './validatePlan'

export interface EditorProps {
  plan: NetworkPlan
  catalog: Catalog
  onChange: (plan: NetworkPlan) => void
}

/** Number inputs give "" while the user is typing; NaN would not survive storage as JSON. */
const toInt = (value: string) => {
  const number = Number.parseInt(value, 10)
  return Number.isNaN(number) ? 0 : number
}

const replaceAt = <T,>(items: T[], index: number, patch: Partial<T>) =>
  items.map((item, position) => (position === index ? { ...item, ...patch } : item))

function interfaceHint(catalog: Catalog, plan: NetworkPlan, switchId: string): string {
  const platform = plan.switches.find((item) => item.id === switchId)?.platform
  const param = platform ? interfaceParam(catalog, platform) : undefined
  return param ? `Ej.: ${param.example}` : ''
}

function SwitchSelect({
  plan,
  value,
  label,
  onChange,
}: {
  plan: NetworkPlan
  value: string
  label: string
  onChange: (id: string) => void
}) {
  return (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Elige…</option>
      {plan.switches.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name.trim() || item.id}
        </option>
      ))}
    </select>
  )
}

export function VlanEditor({ plan, onChange }: EditorProps) {
  const update = (index: number, patch: Partial<PlanVlan>) =>
    onChange({ ...plan, vlans: replaceAt(plan.vlans, index, patch) })
  const add = () => {
    const free = [10, 20, 30, 40, 50, 60, 70, 80, 90, 99].find((id) => !plan.vlans.some((vlan) => vlan.id === id))
    const id = free ?? Math.max(1, ...plan.vlans.map((vlan) => vlan.id)) + 1
    onChange({ ...plan, vlans: [...plan.vlans, { id, name: '', purpose: 'users', subnet: '' }] })
  }

  return (
    <>
      <p className="muted">
        Cada VLAN separa un tipo de tráfico. Marca una como Gestión: es la red por la que vas a administrar los
        switches.
      </p>
      {plan.vlans.length === 0 && (
        <div className="plan-templates">
          <p>Empieza con una plantilla o añade las VLAN una a una:</p>
          <ul>
            {PLAN_TEMPLATES.map((template) => (
              <li key={template.name} className="plan-template">
                <button
                  type="button"
                  className="plan-add"
                  onClick={() => onChange({ ...plan, vlans: template.vlans.map((vlan) => ({ ...vlan })) })}
                >
                  {template.name}
                </button>
                <span className="muted">{template.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {plan.vlans.length > 0 && (
        <div className="plan-table">
          <table aria-label="VLAN del plan">
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Nombre</th>
                <th scope="col">Propósito</th>
                <th scope="col">Red (opcional)</th>
                <th scope="col">
                  <span className="visually-hidden">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {plan.vlans.map((vlan, index) => (
                <tr key={index}>
                  <td>
                    <input
                      type="number"
                      min={1}
                      max={4094}
                      aria-label={`ID de la VLAN ${index + 1}`}
                      value={vlan.id || ''}
                      onChange={(event) => update(index, { id: toInt(event.target.value) })}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Nombre de la VLAN ${index + 1}`}
                      placeholder="Ej.: USUARIOS"
                      value={vlan.name}
                      spellCheck={false}
                      onChange={(event) => update(index, { name: event.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      aria-label={`Propósito de la VLAN ${index + 1}`}
                      value={vlan.purpose}
                      onChange={(event) => update(index, { purpose: event.target.value as PlanVlan['purpose'] })}
                    >
                      {VLAN_PURPOSES.map((purpose) => (
                        <option key={purpose} value={purpose}>
                          {PURPOSE_LABELS[purpose]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      aria-label={`Red de la VLAN ${index + 1}`}
                      placeholder="Ej.: 192.168.10.0/24"
                      value={vlan.subnet}
                      spellCheck={false}
                      onChange={(event) => update(index, { subnet: event.target.value })}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="link-button"
                      aria-label={`Quitar la VLAN ${vlan.id}`}
                      onClick={() =>
                        onChange({ ...plan, vlans: plan.vlans.filter((_, position) => position !== index) })
                      }
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button type="button" className="plan-add" onClick={add}>
        Añadir VLAN
      </button>
    </>
  )
}

export function SwitchEditor({ plan, catalog, onChange }: EditorProps) {
  const update = (index: number, patch: Partial<PlanSwitch>) =>
    onChange({ ...plan, switches: replaceAt(plan.switches, index, patch) })
  const add = () =>
    onChange({
      ...plan,
      switches: [
        ...plan.switches,
        { id: nextId('sw', plan.switches), name: '', platform: '', mgmtIp: '', gateway: '', bridge: '' },
      ],
    })
  // A deleted switch takes its links and ports with it, so nothing points at a switch that is gone.
  const remove = (id: string) =>
    onChange({
      ...plan,
      switches: plan.switches.filter((item) => item.id !== id),
      links: plan.links.filter((link) => link.a.switch !== id && link.b.switch !== id),
      ports: plan.ports.filter((port) => port.switch !== id),
    })
  const makeCore = (index: number) => {
    const chosen = plan.switches[index]
    if (chosen) onChange({ ...plan, switches: [chosen, ...plan.switches.filter((_, position) => position !== index)] })
  }
  const usesBridge = (platform: string) =>
    catalog.procedures.some(
      (item) => item.platform === platform && item.params.some((param) => param.id === 'bridgeName'),
    )

  return (
    <>
      <p className="muted">
        El primero de la lista es el núcleo: la guía empieza por él y sigue hacia los switches que cuelgan de él.
      </p>
      {plan.switches.length > 0 && (
        <div className="plan-table">
          <table aria-label="Switches del plan">
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Modelo</th>
                <th scope="col">IP de gestión</th>
                <th scope="col">Puerta de enlace</th>
                <th scope="col">Bridge</th>
                <th scope="col">
                  <span className="visually-hidden">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {plan.switches.map((item, index) => (
                <tr key={item.id}>
                  <td>
                    <input
                      aria-label={`Nombre del switch ${index + 1}`}
                      placeholder="Ej.: planta1"
                      value={item.name}
                      spellCheck={false}
                      onChange={(event) => update(index, { name: event.target.value })}
                    />
                    {index === 0 && <span className="plan-core">Núcleo</span>}
                  </td>
                  <td>
                    <select
                      aria-label={`Modelo del switch ${index + 1}`}
                      value={item.platform}
                      onChange={(event) => update(index, { platform: event.target.value })}
                    >
                      <option value="">Elige…</option>
                      {catalog.platforms.map((platform) => (
                        <option key={platform.id} value={platform.id}>
                          {platform.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      aria-label={`IP de gestión del switch ${index + 1}`}
                      placeholder="Ej.: 192.168.99.2/24"
                      value={item.mgmtIp}
                      spellCheck={false}
                      onChange={(event) => update(index, { mgmtIp: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Puerta de enlace del switch ${index + 1}`}
                      placeholder="Ej.: 192.168.99.1"
                      value={item.gateway}
                      spellCheck={false}
                      onChange={(event) => update(index, { gateway: event.target.value })}
                    />
                  </td>
                  <td>
                    {usesBridge(item.platform) ? (
                      <input
                        aria-label={`Bridge del switch ${index + 1}`}
                        placeholder="Ej.: bridge1"
                        value={item.bridge}
                        spellCheck={false}
                        onChange={(event) => update(index, { bridge: event.target.value })}
                      />
                    ) : (
                      <span className="muted">No aplica</span>
                    )}
                  </td>
                  <td className="plan-actions">
                    {index > 0 && (
                      <button type="button" className="link-button" onClick={() => makeCore(index)}>
                        Hacer núcleo
                      </button>
                    )}
                    <button
                      type="button"
                      className="link-button"
                      aria-label={`Quitar el switch ${item.name.trim() || index + 1}`}
                      onClick={() => remove(item.id)}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button type="button" className="plan-add" onClick={add}>
        Añadir switch
      </button>
    </>
  )
}

export function LinkEditor({ plan, catalog, onChange }: EditorProps) {
  const update = (index: number, patch: Partial<PlanLink>) =>
    onChange({ ...plan, links: replaceAt(plan.links, index, patch) })
  const [first, second] = plan.switches
  const add = () =>
    onChange({
      ...plan,
      links: [
        ...plan.links,
        {
          id: nextId('ln', plan.links),
          a: { switch: first?.id ?? '', interface: '' },
          b: { switch: second?.id ?? '', interface: '' },
          nativeVlan: 1,
        },
      ],
    })

  return (
    <>
      <p className="muted">
        Cada enlace entre dos switches se configura como trunk en los dos extremos y lleva todas las VLAN del plan. La
        VLAN nativa es la misma en ambos lados.
      </p>
      {plan.links.length > 0 && (
        <div className="plan-table">
          <table aria-label="Enlaces del plan">
            <thead>
              <tr>
                <th scope="col">Switch A</th>
                <th scope="col">Puerto A</th>
                <th scope="col">Switch B</th>
                <th scope="col">Puerto B</th>
                <th scope="col">VLAN nativa</th>
                <th scope="col">
                  <span className="visually-hidden">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {plan.links.map((link, index) => (
                <tr key={link.id}>
                  {(['a', 'b'] as const).map((end) => (
                    <EndpointCells
                      key={end}
                      plan={plan}
                      catalog={catalog}
                      label={`${end.toUpperCase()} del enlace ${index + 1}`}
                      endpoint={link[end]}
                      onChange={(endpoint) => update(index, { [end]: endpoint })}
                    />
                  ))}
                  <td>
                    <input
                      type="number"
                      min={1}
                      max={4094}
                      aria-label={`VLAN nativa del enlace ${index + 1}`}
                      value={link.nativeVlan || ''}
                      onChange={(event) => update(index, { nativeVlan: toInt(event.target.value) })}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="link-button"
                      aria-label={`Quitar el enlace ${index + 1}`}
                      onClick={() => onChange({ ...plan, links: plan.links.filter((item) => item.id !== link.id) })}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button type="button" className="plan-add" onClick={add} disabled={plan.switches.length < 2}>
        Añadir enlace
      </button>
      {plan.switches.length < 2 && <p className="muted">Hacen falta al menos dos switches para unirlos.</p>}
    </>
  )
}

function EndpointCells({
  plan,
  catalog,
  label,
  endpoint,
  onChange,
}: {
  plan: NetworkPlan
  catalog: Catalog
  label: string
  endpoint: PlanLink['a']
  onChange: (endpoint: PlanLink['a']) => void
}) {
  return (
    <>
      <td>
        <SwitchSelect
          plan={plan}
          value={endpoint.switch}
          label={`Switch ${label}`}
          onChange={(id) => onChange({ ...endpoint, switch: id })}
        />
      </td>
      <td>
        <input
          aria-label={`Puerto ${label}`}
          placeholder={interfaceHint(catalog, plan, endpoint.switch)}
          value={endpoint.interface}
          spellCheck={false}
          onChange={(event) => onChange({ ...endpoint, interface: event.target.value })}
        />
      </td>
    </>
  )
}

export function PortEditor({ plan, catalog, onChange }: EditorProps) {
  const update = (index: number, patch: Partial<PlanPort>) =>
    onChange({ ...plan, ports: replaceAt(plan.ports, index, patch) })
  const add = () => {
    const previous = plan.ports.at(-1)
    onChange({
      ...plan,
      ports: [
        ...plan.ports,
        {
          id: nextId('pt', plan.ports),
          switch: previous?.switch ?? plan.switches[0]?.id ?? '',
          interface: '',
          vlan:
            previous?.vlan ?? plan.vlans.find((vlan) => vlan.purpose !== 'management')?.id ?? plan.vlans[0]?.id ?? 1,
        },
      ],
    })
  }

  return (
    <>
      <p className="muted">
        Los puertos de acceso son los que van a un equipo final: un ordenador, un teléfono, una cámara. Cada uno lleva
        una sola VLAN, sin etiqueta.
      </p>
      {plan.ports.length > 0 && (
        <div className="plan-table">
          <table aria-label="Puertos de acceso del plan">
            <thead>
              <tr>
                <th scope="col">Switch</th>
                <th scope="col">Puerto</th>
                <th scope="col">VLAN</th>
                <th scope="col">
                  <span className="visually-hidden">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {plan.ports.map((port, index) => (
                <tr key={port.id}>
                  <td>
                    <SwitchSelect
                      plan={plan}
                      value={port.switch}
                      label={`Switch del puerto ${index + 1}`}
                      onChange={(id) => update(index, { switch: id })}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Puerto ${index + 1}`}
                      placeholder={interfaceHint(catalog, plan, port.switch)}
                      value={port.interface}
                      spellCheck={false}
                      onChange={(event) => update(index, { interface: event.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      aria-label={`VLAN del puerto ${index + 1}`}
                      value={port.vlan}
                      onChange={(event) => update(index, { vlan: toInt(event.target.value) })}
                    >
                      {!plan.vlans.some((vlan) => vlan.id === port.vlan) && (
                        <option value={port.vlan}>{port.vlan} (no está en el plan)</option>
                      )}
                      {plan.vlans.map((vlan) => (
                        <option key={vlan.id} value={vlan.id}>
                          {vlan.id} · {vlan.name || PURPOSE_LABELS[vlan.purpose]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="link-button"
                      aria-label={`Quitar el puerto ${index + 1}`}
                      onClick={() => onChange({ ...plan, ports: plan.ports.filter((item) => item.id !== port.id) })}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button type="button" className="plan-add" onClick={add} disabled={plan.switches.length === 0}>
        Añadir puerto
      </button>
    </>
  )
}
