/**
 * Services Index - Clean exports for the service layer
 */

// Types
export * from './types'

// Service Context & Hooks
export {
  ServiceProvider,
  useService,
  useServiceMode,
  useIsDemoMode,
  useCanWrite,
} from './ServiceContext'

// Direct service access (use sparingly - prefer useService() hook)
export { api as productionService } from './api'
export { demoService } from './demo/demoService'
