function unitLabel(radius, unit) {
  const singular = {
    miles: 'Mile',
    kilometers: 'Kilometer',
    meters: 'Meter',
    feet: 'Foot',
  }[unit];
  const plural = {
    miles: 'Miles',
    kilometers: 'Kilometers',
    meters: 'Meters',
    feet: 'Feet',
  }[unit];
  return `${radius} ${radius === 1 ? singular : plural}`;
}

export default function ResultsCard({ result }) {
  if (!result) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800">Population within Radius</h2>

      <dl className="mt-4 space-y-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Estimated Population</dt>
          <dd className="text-3xl font-bold text-sky-600">
            {result.estimatedPopulation.toLocaleString()}
          </dd>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Radius</dt>
            <dd className="text-sm font-medium text-slate-700">
              {unitLabel(result.input.radius, result.input.unit)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Block Groups</dt>
            <dd className="text-sm font-medium text-slate-700">{result.blockGroupCount}</dd>
          </div>
        </div>

        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Calculation Method</dt>
          <dd className="text-sm font-medium text-slate-700">{result.method}</dd>
        </div>

        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Source</dt>
          <dd className="text-sm font-medium text-slate-700">{result.source}</dd>
        </div>
      </dl>

      {result.blockGroups?.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-sky-600">
            Block group breakdown
          </summary>
          <div className="mt-2 max-h-56 overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400">
                <tr>
                  <th className="py-1 pr-2">GEOID</th>
                  <th className="py-1 pr-2 text-right">Pop.</th>
                  <th className="py-1 pr-2 text-right">Overlap</th>
                  <th className="py-1 text-right">Contrib.</th>
                </tr>
              </thead>
              <tbody className="text-slate-600">
                {result.blockGroups.map((bg) => (
                  <tr key={bg.geoid} className="border-t border-slate-100">
                    <td className="py-1 pr-2 font-mono">{bg.geoid}</td>
                    <td className="py-1 pr-2 text-right">{bg.population.toLocaleString()}</td>
                    <td className="py-1 pr-2 text-right">{bg.weightPercent}%</td>
                    <td className="py-1 text-right">{bg.contribution.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
