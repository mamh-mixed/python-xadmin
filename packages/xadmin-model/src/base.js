import React from 'react'
import _ from 'lodash'
import { Block, app, use } from 'xadmin'
import { C } from 'xadmin-ui'
import { Routes, Route } from "react-router-dom"
import { RecoilRoot, useRecoilSnapshot, useRecoilCallback } from 'recoil'
import modelAtoms from './atoms'

const ModelContext = React.createContext(null)

const getModel = (name, key, props) => {
  const model = app.get('models')[name]
  if(!model) {
    throw Error(`Model '${name}' not found!`)
  }
  model.name = model.name || name
  return {
    ...model,
    key: key || model.name,
    ...props
  }
}

const DebugObserver = () => {
  let snapshot = useRecoilSnapshot();
  React.useEffect(() => {
    if(! snapshot ) return 
    console.debug('[Recoil] state change:');
    for (const node of snapshot.getNodes_UNSTABLE({isModified: true})) {
      console.debug(node.key, snapshot.getLoadable(node));
    }
  }, [snapshot]);
  
  return null;
}

const ModelInitial = ({ model, initialValues, children }) => {
  const query = use('query')
  const [ loading, setLoading ] = React.useState(true)

  const initializeState = useRecoilCallback(({ set }) => () => {
    let initial = initialValues || {}
    if(model.initialValues) {
      let modelInitial = _.isFunction(model.initialValues) ? model.initialValues() : model.initialValues
      initial = { ...modelInitial, ...initial }
    }
    const { wheres={}, ...option } = initial

    const defaultOpt = {
      fields: [ ...(model.listFields || []) ],
      order: model.defaultOrder || model.orders || {},
      limit: model.defaultPageSize || 15,
      skip: 0
    }
    if(query && !_.isEmpty(query)) {
      wheres.param_filter = query
    }
    
    set(model.atoms.option, { ...defaultOpt, ...option })
    set(model.atoms.wheres, wheres)
  }, [ initialValues, model, query ])

  React.useEffect(() => {
    initializeState()
    setLoading(false)
  }, [])

  return !loading ? children : null
}

const Model = ({ name, schema, modelKey, initialValues, children, debug, props: modelProps }) => {
  const model = React.useMemo(() => {
    const model =  name ? getModel(name, modelKey, modelProps) : {
      ...schema,
      key: modelKey || schema.name,
      ...modelProps
    }
    const atoms = [ modelAtoms, ...app.get('modelAtoms') ].reduce((p, getAtoms) => {
      return { ...p, ...getAtoms(id => `model.${model.key}.${id}`, model)}
    }, {})
    return { ...model, atoms }
  }, [ name, schema, modelKey ])

  // const initializeState = React.useCallback(({ set }) => {
  //   let initial = initialValues || {}
  //   if(model.initialValues) {
  //     let modelInitial = _.isFunction(model.initialValues) ? model.initialValues() : model.initialValues
  //     initial = { ...modelInitial, ...initial }
  //   }
  //   const { wheres={}, ...option } = initial

  //   const defaultOpt = {
  //     fields: [ ...(model.listFields || []) ],
  //     order: model.defaultOrder || model.orders || {},
  //     limit: model.defaultPageSize || 15,
  //     skip: 0
  //   }
  //   if(query && !_.isEmpty(query)) {
  //     wheres.param_filter = query
  //   }
    
  //   set(model.atoms.option, { ...defaultOpt, ...option })
  //   set(model.atoms.wheres, wheres)
  // }, [ initialValues, model, query ])

  return model && (
    <RecoilRoot override={false}>
      { (model.debug || debug) && <DebugObserver /> }
      <ModelContext.Provider value={model}>
        <ModelInitial initialValues={initialValues} model={model} >
          {children}
        </ModelInitial>
      </ModelContext.Provider>
    </RecoilRoot>
  )
}

const ModelBlock = (props) => (
  <ModelContext.Consumer>
    { model => (
      <Block model={model} {...props} >
        { blocks => {
          const modelBlock = model && model.blocks && model.blocks[props.name]
          if(modelBlock) {
            const mb = modelBlock(props)
            blocks = blocks ? [ mb, ...blocks ] : [ mb ]
          }
          return props.children ? props.children(blocks) : blocks
        } }
      </Block>
    ) }
  </ModelContext.Consumer>
)

const ModelRoutes = () => {
  const { model } = use('model')

  const ModelList = model.components && model.components['ListPage'] || C('Model.ListPage')
  const ModelDetail =  model.components && model.components['DetailPage'] || C('Model.DetailPage')
  const ModelAddForm = model.components && model.components['AddPage'] || C('Model.FormPage')
  const ModelEditForm = model.components && model.components['EditPage'] || C('Model.FormPage')

  return (
    <Routes>
      { (!model.permission || model.permission.view) && <Route
        path="/"
        element={<ModelList />}
      /> }
      { (!model.permission || model.permission.view) && <Route
        path="list"
        element={<ModelList />}
      /> }
      { (!model.permission || model.permission.view) && <Route
        path=":id/detail"
        element={<ModelDetail />}
      /> }
      { (!model.permission || model.permission.add) && <Route
        path="add"
        element={<ModelAddForm />}
      /> }
      { (!model.permission || model.permission.edit) && <Route
        path=":id/edit"
        element={<ModelEditForm />}
      /> }
    </Routes>
  )
}

export {
  ModelContext,
  ModelBlock,
  ModelRoutes,
  Model
}
