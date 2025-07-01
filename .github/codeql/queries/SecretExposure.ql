/**
 * @name Secret Exposure in GitHub Actions
 * @description Detects potential secret exposure in GitHub Actions workflows
 * @kind problem
 * @id js/secret-exposure-in-workflows
 * @problem.severity warning
 * @precision medium
 * @tags security
 *       external/cwe/cwe-532
 */

import javascript
import yaml

/**
 * A GitHub Actions workflow file that might contain secrets
 */
class WorkflowFile extends @yaml::YamlFile {
  WorkflowFile() {
    this.getAbsolutePath().matches("%/workflows/%.yml") or
    this.getAbsolutePath().matches("%/workflows/%.yaml")
  }
}

/**
 * A secret reference in a workflow file
 */
class SecretReference extends @yaml::YamlNode {
  SecretReference() {
    exists(string value |
      value = this.getStringValue() and
      value.matches("${{%secrets.%}}")
    )
  }
}

/**
 * A potentially dangerous step that might expose secrets
 */
class DangerousStep extends @yaml::YamlNode {
  DangerousStep() {
    exists(string stepName |
      stepName = this.getChild("name").getStringValue() and
      (
        stepName.matches("%echo%") or
        stepName.matches("%print%") or
        stepName.matches("%log%") or
        stepName.matches("%debug%")
      )
    )
  }
}

from WorkflowFile wf, SecretReference secret, DangerousStep step
where
  secret.getParentContainer() = step.getParentContainer() and
  step.getParentContainer().getParentContainer() = wf
select step, "This step might expose secrets through logging or output" 