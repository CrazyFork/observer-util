// type: Map<obj, object<key, Set<Reaction>>>
const connectionStore = new WeakMap()
const ITERATION_KEY = Symbol('iteration key')

export function storeObservable (obj) {
  // this will be used to save (obj.key -> reaction) connections later
  connectionStore.set(obj, Object.create(null))
}

/**
 * register reaction into connectionStore.
 * 
 * connectionStore is a central hub for all object with certain reaction.
 * 
 * @param {} reaction 
 * @param {*} 
 *  - target , target obj
 *  - key, 
 *  - type
 *    - iterate, loop type
 */
export function registerReactionForOpertion (reaction, { target, key, type }) {
  if (type === 'iterate') {
    key = ITERATION_KEY
  }

  const reactionsForObj = connectionStore.get(target)
  let reactionsForKey = reactionsForObj[key]
  if (!reactionsForKey) {
    reactionsForObj[key] = reactionsForKey = new Set()
  }
  // save the fact that the key is used by the reaction during its current run
  if (!reactionsForKey.has(reaction)) {
    reactionsForKey.add(reaction)
    reaction.cleaners.push(reactionsForKey)
  }
}

/**
 * retrive all the reactions for certain target with type & key
 * if type is clear, then all the keys under reactionsForTarget is retrived 
 * if type is add/delete/clear then reactions for length/ITERATION_KEY is returned
 * 
 * @param {*} 
 *  - target
 *  - key
 *  - type
 * 
 */
export function getReactionsForOperation ({ target, key, type }) {
  const reactionsForTarget = connectionStore.get(target)
  const reactionsForKey = new Set()

  if (type === 'clear') { // all entries under target obj
    for (let key in reactionsForTarget) {
      addReactionsForKey(reactionsForKey, reactionsForTarget, key)
    }
  } else { // all entries under target obj with key 
    addReactionsForKey(reactionsForKey, reactionsForTarget, key)
  }
  // :bm
  // :Q, why keys in here are different than others
  // :A, 应该是 add, delete, clear 都不好 generalize 吧  
  if (type === 'add' || type === 'delete' || type === 'clear') { 
    const iterationKey = Array.isArray(target) ? 'length' : ITERATION_KEY
    addReactionsForKey(reactionsForKey, reactionsForTarget, iterationKey)
  }

  return reactionsForKey
}

// cp reactionsForTarget[key] into reactionsForKey
function addReactionsForKey (reactionsForKey, reactionsForTarget, key) {
  const reactions = reactionsForTarget[key]
  reactions && reactions.forEach(reactionsForKey.add, reactionsForKey)
}

export function releaseReaction (reaction) {
  // cleaners is a reference to collection that holds the reaction entity. defined in above
  // cleaners: Array<Set<reaction>>
  if (reaction.cleaners) {
    reaction.cleaners.forEach(releaseReactionKeyConnection, reaction)
  }
  // Q: why cleaners has to be reset in here, the way i see it just clean a certain reaction
  // & then remove the whole set of cleaner ?
  // A: cleaners is tied with reaction, so it'll be fine
  reaction.cleaners = [] 
}

function releaseReactionKeyConnection (reactionsForKey) {
  reactionsForKey.delete(this)
}
